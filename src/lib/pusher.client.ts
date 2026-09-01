"use client";

import Pusher, { type Channel } from "pusher-js";

/**
 * The browser's single Pusher connection.
 *
 * One socket serves every channel the app subscribes to, so the connection is
 * created once and kept for the life of the tab rather than per component.
 *
 * Subscriptions are reference counted. `pusher.unsubscribe` is absolute — it
 * drops the channel for whoever else is listening — and the sidebar badge and
 * the chat workspace both listen on the user channel, so a component leaving
 * has to say "I am done with this" rather than "close this".
 *
 * With no credentials configured every entry point returns null and the chat
 * falls back to polling. That keeps a checkout without Pusher keys usable
 * instead of broken.
 */

const key = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "";

export const realtimeConfigured = Boolean(key && cluster);

let instance: Pusher | null = null;

/** Channel name to the number of components currently listening on it. */
const listeners = new Map<string, number>();

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined" || !realtimeConfigured) return null;

  if (!instance) {
    instance = new Pusher(key, {
      cluster,
      forceTLS: true,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
  }

  return instance;
}

/** Subscribes, or hands back the channel someone else already opened. */
export function subscribeChannel(name: string): Channel | null {
  const pusher = getPusherClient();

  if (!pusher) return null;

  listeners.set(name, (listeners.get(name) ?? 0) + 1);

  return pusher.subscribe(name);
}

/** Drops one listener, and the channel itself once the last one leaves. */
export function releaseChannel(name: string): void {
  const pusher = getPusherClient();
  const remaining = (listeners.get(name) ?? 1) - 1;

  if (remaining > 0) {
    listeners.set(name, remaining);
    return;
  }

  listeners.delete(name);
  pusher?.unsubscribe(name);
}
