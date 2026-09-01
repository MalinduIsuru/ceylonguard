"use client";

import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useChannel, useRealtimeConnection } from "@/hooks/use-realtime";
import { CHAT_EVENTS, userChannel, type InboxEvent } from "@/lib/chat";

/**
 * Unread messages across every thread, for the sidebar badge.
 *
 * The count rides the user channel, so it moves the moment a message lands
 * anywhere — including on a page that has nothing to do with chat. Without a
 * socket it falls back to a slow poll, and it is re-read on navigation because
 * leaving the chat page usually means something was just read.
 */

/** Slow on purpose: this is a badge, not the chat itself. */
const POLL_MS = 30_000;

export function useUnreadChatCount(): number {
  const { user } = useUser();
  const pathname = usePathname();
  const { live } = useRealtimeConnection();

  const [total, setTotal] = useState(0);

  const clerkId = user?.id;

  const refresh = useCallback(() => {
    if (!clerkId) return;

    void fetch("/api/chat/unread", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ total?: number }>)
      .then((payload) => setTotal(payload.total ?? 0))
      .catch(() => {
        // A stale badge is better than a broken sidebar.
      });
  }, [clerkId]);

  useEffect(refresh, [refresh, pathname]);

  useEffect(() => {
    if (live || !clerkId) return;

    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [live, clerkId, refresh]);

  const onInbox = useCallback(
    (event: InboxEvent) => setTotal(event.totalUnread),
    [],
  );

  useChannel(clerkId ? userChannel(clerkId) : null, {
    [CHAT_EVENTS.inbox]: onInbox as (data: never) => void,
  });

  return total;
}
