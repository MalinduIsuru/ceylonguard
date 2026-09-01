"use client";

import type { Channel, PresenceChannel } from "pusher-js";

import { PRESENCE_CHANNEL } from "@/lib/chat";
import { releaseChannel, subscribeChannel } from "@/lib/pusher.client";

/**
 * Who has CeylonGuard open, held as a store outside React.
 *
 * There is one presence channel for the whole app, so there is one membership
 * list, and everything that draws an online dot should be reading that same
 * one. A per-component subscription could not be: `subscription_succeeded`
 * fires once, when the channel first comes up, so a component mounting after
 * that — the chat page opened from the dashboard, say — would never receive
 * the roster it missed and would start out believing everybody is offline.
 *
 * Keeping it here means a late arrival reads the roster that is already
 * there. It is also why this is read through `useSyncExternalStore` rather
 * than an effect: the membership list is external state that exists before
 * any component asks for it.
 */

let members: ReadonlySet<string> = new Set();
let channel: Channel | null = null;

/** How many hooks are currently reading, so the channel outlives each one. */
let readers = 0;

const listeners = new Set<() => void>();

function publish(next: ReadonlySet<string>): void {
  members = next;

  for (const listener of listeners) listener();
}

/**
 * Re-reads the roster off the channel.
 *
 * Publishes only on a real change, because the snapshot has to keep its
 * identity between updates or `useSyncExternalStore` will re-render forever.
 */
function readRoster(): void {
  const presence = channel as PresenceChannel | null;
  const ids = Object.keys(presence?.members?.members ?? {}) as string[];

  if (ids.length === members.size && ids.every((id) => members.has(id))) return;

  publish(new Set(ids));
}

function onMemberAdded(member: { id: string }): void {
  if (members.has(member.id)) return;

  publish(new Set(members).add(member.id));
}

function onMemberRemoved(member: { id: string }): void {
  if (!members.has(member.id)) return;

  const next = new Set(members);
  next.delete(member.id);

  publish(next);
}

/** Announces this tab, and keeps the roster current while anyone is reading. */
export function subscribeToPresence(listener: () => void): () => void {
  listeners.add(listener);
  readers += 1;

  if (!channel) {
    channel = subscribeChannel(PRESENCE_CHANNEL);

    channel?.bind("pusher:subscription_succeeded", readRoster);
    channel?.bind("pusher:member_added", onMemberAdded);
    channel?.bind("pusher:member_removed", onMemberRemoved);
  }

  // The channel may already be up, in which case no event is coming and the
  // roster is simply there to be read.
  readRoster();

  return () => {
    listeners.delete(listener);
    readers -= 1;

    if (readers > 0) return;

    if (channel) {
      channel.unbind("pusher:subscription_succeeded", readRoster);
      channel.unbind("pusher:member_added", onMemberAdded);
      channel.unbind("pusher:member_removed", onMemberRemoved);
      channel = null;

      releaseChannel(PRESENCE_CHANNEL);
    }

    // Nobody is listening, so this is a plain reset rather than a publish.
    members = new Set();
  };
}

export function onlineSnapshot(): ReadonlySet<string> {
  return members;
}

/** Nobody is connected during a server render. */
const NOBODY: ReadonlySet<string> = new Set();

export function offlineSnapshot(): ReadonlySet<string> {
  return NOBODY;
}
