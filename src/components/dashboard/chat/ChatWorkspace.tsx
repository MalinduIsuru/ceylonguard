"use client";

import { useUser } from "@clerk/nextjs";
import { CircleX, Loader2, MessagesSquare, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import ChatThread from "@/components/dashboard/chat/ChatThread";
import ConversationList from "@/components/dashboard/chat/ConversationList";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineUsers } from "@/hooks/use-presence";
import { useChannel, useRealtimeConnection } from "@/hooks/use-realtime";
import {
  CHAT_EVENTS,
  userChannel,
  type ChatConversation,
  type ConversationsResponse,
  type InboxEvent,
  type StartConversationResponse,
} from "@/lib/chat";

/**
 * The chat screen.
 *
 * Both Chat buttons land here with the trade named in the URL rather than the
 * thread — the offers page knows an offer id, the marketplace knows a listing
 * id, and neither knows whether a conversation exists yet. Resolving that to a
 * thread is one POST, and the URL is rewritten to the thread id afterwards so
 * a refresh does not repeat it.
 *
 * This component owns the left rail and nothing else. The open conversation is
 * mounted as `ChatThread` keyed on its id, which is what keeps one thread's
 * messages, typing and presence from ever leaking into the next one.
 *
 * The rail is not the source of truth for what is open. A thread nobody has
 * spoken in yet is not listed at all — that is the point of the Chat buttons
 * being the only way in — so the pane is mounted from `activeId` and the
 * thread describes itself once it has read the server.
 *
 * The user channel is subscribed here so the list stays live for threads that
 * are not open; `ChatThread` listens on its own channel for the one that is.
 */

type Props = {
  /** From the farmer's offers inbox. */
  offerId?: string;
  /** From the factory's marketplace feed. */
  listingId?: string;
  /** A thread id straight from the URL. */
  conversationId?: string;
};

const GENERIC_ERROR = "Your messages could not be loaded right now.";
const OFFLINE_ERROR = "Could not reach the CeylonGuard server.";

/** How often the rail is pulled while the realtime socket is not connected. */
const LIST_POLL_MS = 8000;

/** Newest thread first; a thread with no messages sorts by when it opened. */
function sortThreads(threads: ChatConversation[]): ChatConversation[] {
  return [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Threads from the server win over what is on screen, by id. */
function mergeThreads(
  current: ChatConversation[],
  incoming: ChatConversation[],
): ChatConversation[] {
  const byId = new Map(incoming.map((thread) => [thread.id, thread]));

  for (const thread of current) {
    if (!byId.has(thread.id)) byId.set(thread.id, thread);
  }

  return sortThreads([...byId.values()]);
}

const ChatWorkspace = ({ offerId, listingId, conversationId }: Props) => {
  const { user } = useUser();
  const viewerClerkId = user?.id ?? "";

  const isMobile = useIsMobile();
  const { live } = useRealtimeConnection();

  /** Everyone with CeylonGuard open, which is what the online dots read. */
  const online = useOnlineUsers();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    conversationId ?? null,
  );

  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  /** On a narrow screen only one pane is on screen at a time. */
  const [mobileView, setMobileView] = useState<"list" | "thread">(
    offerId || listingId || conversationId ? "thread" : "list",
  );

  /** Bumped by the retry button so the list effect is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  const active = useMemo(
    () => conversations.find((thread) => thread.id === activeId) ?? null,
    [conversations, activeId],
  );

  const absorb = useCallback((incoming: ChatConversation) => {
    setConversations((current) => mergeThreads(current, [incoming]));
  }, []);

  const clearBadge = useCallback((id: string) => {
    setConversations((current) =>
      current.map((thread) =>
        thread.id === id ? { ...thread, unread: 0 } : thread,
      ),
    );
  }, []);

  /* ---------------------------------------------------------------- *
   * Loading
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    fetch("/api/chat/conversations", { cache: "no-store" })
      .then((response) => response.json() as Promise<ConversationsResponse>)
      .then((payload) => {
        if (cancelled) return;

        setLoadingList(false);

        if (!payload.ok) {
          setListError(payload.error || GENERIC_ERROR);
          return;
        }

        setListError(null);
        setConversations((current) => mergeThreads(current, payload.items));

        // Nothing is opened here on purpose. A thread is opened by being
        // asked for — a row in the rail, a Chat button, or a `?c=` in the URL
        // — never by being the newest one, which would silently mark somebody
        // else's unread messages as read.
      })
      .catch(() => {
        if (cancelled) return;

        setLoadingList(false);
        setListError(OFFLINE_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // The two Chat buttons: resolve the trade they named into a thread.
  useEffect(() => {
    if (!offerId && !listingId) return;

    let cancelled = false;

    fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offerId ? { offerId } : { listingId }),
    })
      .then((response) => response.json() as Promise<StartConversationResponse>)
      .then((payload) => {
        if (cancelled) return;

        if (!payload.ok) {
          setListError(payload.error);
          return;
        }

        setConversations((current) =>
          mergeThreads(current, [payload.conversation]),
        );
        setActiveId(payload.conversation.id);
        setMobileView("thread");

        // Rewrite the URL to the thread so a refresh reopens it rather than
        // resolving the trade a second time.
        window.history.replaceState(
          null,
          "",
          `/dashboard/chat?c=${payload.conversation.id}`,
        );
      })
      .catch(() => {
        if (!cancelled) setListError(OFFLINE_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [offerId, listingId]);

  /* ---------------------------------------------------------------- *
   * Realtime, for the threads that are not open
   * ---------------------------------------------------------------- */

  const onInbox = useCallback((event: InboxEvent) => {
    setConversations((current) => mergeThreads(current, [event.conversation]));
  }, []);

  useChannel(viewerClerkId ? userChannel(viewerClerkId) : null, {
    [CHAT_EVENTS.inbox]: onInbox as (data: never) => void,
  });

  // No socket: pull the rail on a timer, so a thread somebody has just spoken
  // in for the first time still turns up without a reload.
  useEffect(() => {
    if (live) return;

    const timer = setInterval(() => {
      if (document.hidden) return;

      void fetch("/api/chat/conversations", { cache: "no-store" })
        .then((response) => response.json() as Promise<ConversationsResponse>)
        .then((payload) => {
          if (payload.ok) {
            setConversations((current) => mergeThreads(current, payload.items));
          }
        })
        .catch(() => {
          // The next tick tries again.
        });
    }, LIST_POLL_MS);

    return () => clearInterval(timer);
  }, [live]);

  /* ---------------------------------------------------------------- *
   * Interaction
   * ---------------------------------------------------------------- */

  const openThread = useCallback((id: string) => {
    setActiveId(id);
    setMobileView("thread");

    window.history.replaceState(null, "", `/dashboard/chat?c=${id}`);
  }, []);

  const retryList = useCallback(() => {
    setLoadingList(true);
    setListError(null);
    setReloadToken((current) => current + 1);
  }, []);

  // On a narrow screen the list can be covering the thread pane, and a thread
  // nobody can see must not mark itself read — so it is not mounted at all.
  const threadOnScreen = !isMobile || mobileView === "thread";

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-128 overflow-hidden rounded-3xl border border-border bg-card shadow-card lg:h-[calc(100dvh-5rem)]">
      <aside
        className={`w-full shrink-0 border-r border-border/70 bg-white md:flex md:w-80 lg:w-88 ${
          mobileView === "list" ? "flex" : "hidden"
        }`}
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          {listError ? (
            <div className="m-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
              <CircleX className="mt-0.5 size-4 shrink-0 text-red-600" />

              <div className="min-w-0 flex-1">
                <p className="text-xs leading-relaxed text-red-800">
                  {listError}
                </p>

                <Button
                  variant="leafOutline"
                  size="sm"
                  className="mt-2"
                  onClick={retryList}
                >
                  <RefreshCw className="size-3.5" /> Try again
                </Button>
              </div>
            </div>
          ) : null}

          <ConversationList
            conversations={conversations}
            activeId={activeId}
            loading={loadingList}
            viewerClerkId={viewerClerkId}
            online={online}
            onSelect={openThread}
          />
        </div>
      </aside>

      <section
        className={`min-w-0 flex-1 flex-col ${
          mobileView === "thread" ? "flex" : "hidden md:flex"
        }`}
      >
        {activeId && threadOnScreen ? (
          <ChatThread
            key={activeId}
            conversationId={activeId}
            initial={active}
            viewerClerkId={viewerClerkId}
            live={live}
            online={online}
            onBack={() => setMobileView("list")}
            onConversation={absorb}
            onRead={clearBadge}
          />
        ) : (
          <div className="grid h-full place-items-center gradient-mist px-6 text-center">
            {loadingList ? (
              <Loader2 className="size-5 animate-spin text-leaf" />
            ) : (
              <div className="grid justify-items-center gap-3">
                <span className="grid size-16 place-items-center rounded-full bg-leaf-soft">
                  <MessagesSquare className="size-7 text-leaf-strong" />
                </span>
                <h2 className="font-display text-lg font-bold text-leaf-strong">
                  {conversations.length > 0
                    ? "Pick a conversation"
                    : "No conversations yet"}
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {conversations.length > 0
                    ? "Choose a trader on the left to read the thread, or press Chat with… on an offer or a marketplace listing to start a new one."
                    : "Press Chat with… on an offer you have received, or on a harvest in the marketplace, and send a message to start a conversation."}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default ChatWorkspace;
