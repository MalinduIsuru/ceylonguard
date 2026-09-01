"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  getPusherClient,
  realtimeConfigured,
  releaseChannel,
  subscribeChannel,
} from "@/lib/pusher.client";

/**
 * React bindings over the shared Pusher connection.
 *
 * Handlers are read through a ref so a channel is bound once per name rather
 * than re-bound on every render — the callbacks passed in are almost always
 * fresh closures, and re-subscribing on each keystroke would drop events.
 */

export type RealtimeState =
  | "off"
  | "initialized"
  | "connecting"
  | "connected"
  | "unavailable"
  | "failed"
  | "disconnected";

export type RealtimeConnection = {
  state: RealtimeState;
  /** True only while events can actually arrive. */
  live: boolean;
  /** Sent with typing pings so a composer is excluded from its own echo. */
  socketId?: string;
  /** False when the deployment has no Pusher credentials at all. */
  configured: boolean;
};

/**
 * The socket is a store outside React, so it is read as one.
 *
 * `useSyncExternalStore` is the right primitive here rather than an effect:
 * the connection may already be up by the time a component mounts, and this
 * reads whatever state it is actually in instead of assuming one and then
 * correcting it on the next tick.
 */
function subscribeToConnection(onChange: () => void): () => void {
  const pusher = getPusherClient();

  if (!pusher) return () => {};

  pusher.connection.bind("state_change", onChange);

  return () => {
    pusher.connection.unbind("state_change", onChange);
  };
}

function readState(): RealtimeState {
  return (getPusherClient()?.connection.state as RealtimeState) ?? "off";
}

function readSocketId(): string | undefined {
  return getPusherClient()?.connection.socket_id || undefined;
}

/** Nothing is connected during a server render. */
const serverState = (): RealtimeState => "off";
const noSocket = (): string | undefined => undefined;

export function useRealtimeConnection(): RealtimeConnection {
  const state = useSyncExternalStore(
    subscribeToConnection,
    readState,
    serverState,
  );

  const socketId = useSyncExternalStore(
    subscribeToConnection,
    readSocketId,
    noSocket,
  );

  return {
    state,
    live: state === "connected",
    ...(socketId ? { socketId } : {}),
    configured: realtimeConfigured,
  };
}

export type ChannelHandlers = Record<string, (data: never) => void>;

/**
 * Binds a set of events on one channel for as long as `name` stays put.
 *
 * Pass `null` for the name to listen to nothing — that is how the workspace
 * stops listening to a thread the moment another one is opened.
 */
export function useChannel(name: string | null, handlers: ChannelHandlers) {
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  // The set of event names is what the subscription actually depends on. The
  // functions behind them are fresh closures on every render, so binding on
  // the object itself would re-subscribe constantly and drop events; this
  // string is stable for as long as the same events are being listened for.
  const events = Object.keys(handlers).sort().join("|");

  useEffect(() => {
    if (!name || !events) return;

    const channel = subscribeChannel(name);

    if (!channel) return;

    const bound = events.split("|").map((event) => {
      const handler = (data: unknown) => {
        const callback = latest.current[event];

        if (callback) (callback as (payload: unknown) => void)(data);
      };

      channel.bind(event, handler);

      return { event, handler };
    });

    return () => {
      for (const { event, handler } of bound) channel.unbind(event, handler);

      releaseChannel(name);
    };
  }, [name, events]);
}
