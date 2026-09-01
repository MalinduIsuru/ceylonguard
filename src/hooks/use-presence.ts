"use client";

import { useSyncExternalStore } from "react";

import {
  offlineSnapshot,
  onlineSnapshot,
  subscribeToPresence,
} from "@/lib/presence.client";

/**
 * The clerk ids of everyone with CeylonGuard open, this tab included.
 *
 * Reading it is also joining: the hook announces the current tab for as long
 * as something is rendering it, which is why `PresenceBeacon` sits in the
 * dashboard layout and does nothing else. Without Pusher credentials the set
 * is simply always empty, and no dot is drawn anywhere.
 */
export function useOnlineUsers(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeToPresence,
    onlineSnapshot,
    offlineSnapshot,
  );
}
