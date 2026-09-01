"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import MessageComposer from "@/components/dashboard/chat/MessageComposer";
import MessageList from "@/components/dashboard/chat/MessageList";
import ThreadHeader from "@/components/dashboard/chat/ThreadHeader";
import type { ThreadLine } from "@/components/dashboard/chat/types";
import { useChannel } from "@/hooks/use-realtime";
import {
  CHAT_EVENTS,
  threadChannel,
  userChannel,
  TYPING_TIMEOUT_MS,
  type ChatConversation,
  type ChatMessage,
  type InboxEvent,
  type MessagesResponse,
  type ReadEvent,
  type SendMessageResponse,
  type TypingEvent,
} from "@/lib/chat";

/**
 * One open conversation: its history, its realtime, and its composer.
 *
 * Mounted with the conversation id as its key, so opening another thread
 * replaces this component rather than clearing it — every piece of state here
 * belongs to one conversation and should not outlive it.
 *
 * The thread describes itself. `initial` is only a first paint, because the
 * conversation list no longer carries every thread: one that has just been
 * opened by a Chat button, and not yet spoken in, is deliberately absent from
 * it. The read this component does on mount is what fills in the rest, and is
 * why a bare `?c=<id>` in the URL still opens correctly.
 *
 * The parent is told about the thread whenever it changes, so the left rail
 * can show it the moment it stops being empty.
 */

type Props = {
  conversationId: string;
  /** What the list already knew, if anything. Read once, at mount. */
  initial: ChatConversation | null;
  viewerClerkId: string;
  /** False when the realtime socket is down, which turns the poll on. */
  live: boolean;
  /** Everyone with CeylonGuard open, for the header's dot. */
  online: ReadonlySet<string>;
  onBack: () => void;
  /** The thread as the server now describes it, for the list. */
  onConversation: (conversation: ChatConversation) => void;
  /** This thread has been read; clear its badge. */
  onRead: (conversationId: string) => void;
};

const OFFLINE_ERROR = "Could not reach the CeylonGuard server.";

/** How often the thread is pulled while the realtime socket is not connected. */
const POLL_MS = 5000;

const FARMER_OPENERS = [
  "Is this price your final offer?",
  "When can you collect the leaf?",
  "The harvest is ready for pickup.",
];

const FACTORY_OPENERS = [
  "Is the price negotiable?",
  "Can you confirm the pickup date?",
  "Do you have more of this grade?",
];

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const ChatThread = ({
  conversationId,
  initial,
  viewerClerkId,
  live,
  online,
  onBack,
  onConversation,
  onRead,
}: Props) => {
  const [thread, setThread] = useState<ChatConversation | null>(initial);

  const [lines, setLines] = useState<ThreadLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);

  const [threadError, setThreadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [typingName, setTypingName] = useState<string | null>(null);
  /** Who has this exact thread open, which is narrower than `online`. */
  const [inThread, setInThread] = useState<string[]>([]);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Read by the send path, which has to patch the thread it does not re-read. */
  const threadRef = useRef(thread);

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  /* ---------------------------------------------------------------- *
   * State helpers
   * ---------------------------------------------------------------- */

  /** Takes a fresh view of the thread, and passes it on to the list. */
  const absorb = useCallback(
    (next: ChatConversation) => {
      setThread(next);
      onConversation(next);
    },
    [onConversation],
  );

  /** Adds or replaces a line, dropping the optimistic twin it confirms. */
  const upsertLine = useCallback((incoming: ThreadLine) => {
    setLines((current) => {
      const withoutTwin = incoming.clientId
        ? current.filter(
            (line) => !(line.pending && line.clientId === incoming.clientId),
          )
        : current;

      const index = withoutTwin.findIndex((line) => line.id === incoming.id);

      if (index >= 0) {
        const next = [...withoutTwin];
        next[index] = incoming;

        return next;
      }

      return [...withoutTwin, incoming].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, []);

  /** A server page, keeping anything still in flight on screen. */
  const applyServerPage = useCallback((items: ChatMessage[]) => {
    setLines((current) => {
      const confirmed = new Set(
        items.map((item) => item.clientId).filter(Boolean),
      );

      const inFlight = current.filter(
        (line) =>
          (line.pending || line.failed) &&
          (!line.clientId || !confirmed.has(line.clientId)),
      );

      return [...items, ...inFlight];
    });
  }, []);

  const markRead = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/read`,
        { method: "POST" },
      );

      if (response.ok) onRead(conversationId);
    } catch {
      // A missed read mark corrects itself the next time the thread is opened.
    }
  }, [conversationId, onRead]);

  /* ---------------------------------------------------------------- *
   * Loading
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/chat/conversations/${conversationId}/messages`, {
      cache: "no-store",
    })
      .then((response) => response.json() as Promise<MessagesResponse>)
      .then((payload) => {
        if (cancelled) return;

        setLoading(false);

        if (!payload.ok) {
          setThreadError(payload.error);
          return;
        }

        applyServerPage(payload.items);
        setHasMore(payload.hasMore);
        absorb(payload.conversation);

        if (payload.conversation.unread > 0) void markRead();
      })
      .catch(() => {
        if (cancelled) return;

        setLoading(false);
        setThreadError(OFFLINE_ERROR);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, absorb, applyServerPage, markRead]);

  const loadEarlier = useCallback(async () => {
    const oldest = lines.find((line) => !line.pending && !line.failed);

    if (!oldest || loadingMore) return;

    setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages?before=${encodeURIComponent(
          oldest.createdAt,
        )}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as MessagesResponse;

      if (payload.ok) {
        setLines((current) => [...payload.items, ...current]);
        setHasMore(payload.hasMore);
      }
    } catch {
      // The button stays put; pressing it again is the retry.
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, lines, loadingMore]);

  /* ---------------------------------------------------------------- *
   * Sending
   * ---------------------------------------------------------------- */

  const send = useCallback(
    async (body: string, retryOf?: ThreadLine) => {
      if (!viewerClerkId) return;

      const clientId = retryOf?.clientId ?? newClientId();

      const optimistic: ThreadLine = {
        id: `pending-${clientId}`,
        conversationId,
        senderClerkId: viewerClerkId,
        body,
        createdAt: new Date().toISOString(),
        clientId,
        pending: true,
      };

      setSendError(null);
      setSending(true);
      setLines((current) => [
        ...current.filter((line) => line.clientId !== clientId),
        optimistic,
      ]);

      const fail = (message: string) => {
        setSendError(message);
        setLines((current) =>
          current.map((line) =>
            line.clientId === clientId
              ? { ...line, pending: false, failed: true }
              : line,
          ),
        );
      };

      try {
        const response = await fetch(
          `/api/chat/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body, clientId }),
          },
        );

        const payload = (await response.json()) as SendMessageResponse;

        if (!payload.ok) {
          fail(payload.error);
          return;
        }

        upsertLine(payload.message);

        // This is the moment a room becomes a conversation: the first message
        // is what puts the thread into the left rail. Patched locally rather
        // than waited for, so it lands with or without a realtime socket.
        const current = threadRef.current;

        if (current) {
          absorb({
            ...current,
            lastMessage: payload.message,
            updatedAt: payload.message.createdAt,
          });
        }
      } catch {
        fail(OFFLINE_ERROR);
      } finally {
        setSending(false);
      }
    },
    [absorb, conversationId, upsertLine, viewerClerkId],
  );

  const announceTyping = useCallback(
    (typing: boolean) => {
      if (!live) return;

      void fetch(`/api/chat/conversations/${conversationId}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing }),
      }).catch(() => {
        // A dropped typing ping is not worth reporting.
      });
    },
    [conversationId, live],
  );

  /* ---------------------------------------------------------------- *
   * Realtime
   * ---------------------------------------------------------------- */

  const onMessage = useCallback(
    (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;

      upsertLine(message);

      if (message.senderClerkId !== viewerClerkId) {
        setTypingName(null);

        if (!document.hidden) void markRead();
      }
    },
    [conversationId, markRead, upsertLine, viewerClerkId],
  );

  const onTypingEvent = useCallback(
    (event: TypingEvent) => {
      if (event.clerkId === viewerClerkId) return;

      if (typingTimer.current) clearTimeout(typingTimer.current);

      if (!event.typing) {
        setTypingName(null);
        return;
      }

      setTypingName(event.name);

      // The sender retracts the flag when the keys stop, but a tab that closes
      // mid-sentence never will — so it also expires on its own.
      typingTimer.current = setTimeout(
        () => setTypingName(null),
        TYPING_TIMEOUT_MS,
      );
    },
    [viewerClerkId],
  );

  const onReadEvent = useCallback(
    (event: ReadEvent) => {
      if (event.clerkId === viewerClerkId) return;

      setThread((current) =>
        current ? { ...current, partnerReadAt: event.readAt } : current,
      );
    },
    [viewerClerkId],
  );

  const onPresence = useCallback(
    (members: { members?: Record<string, unknown> }) =>
      setInThread(Object.keys(members.members ?? {})),
    [],
  );

  const onMemberAdded = useCallback(
    (member: { id: string }) =>
      setInThread((current) =>
        current.includes(member.id) ? current : [...current, member.id],
      ),
    [],
  );

  const onMemberRemoved = useCallback(
    (member: { id: string }) =>
      setInThread((current) => current.filter((id) => id !== member.id)),
    [],
  );

  useChannel(threadChannel(conversationId), {
    [CHAT_EVENTS.message]: onMessage as (data: never) => void,
    [CHAT_EVENTS.typing]: onTypingEvent as (data: never) => void,
    [CHAT_EVENTS.read]: onReadEvent as (data: never) => void,
    "pusher:subscription_succeeded": onPresence as (data: never) => void,
    "pusher:member_added": onMemberAdded as (data: never) => void,
    "pusher:member_removed": onMemberRemoved as (data: never) => void,
  });

  /**
   * The same message, off the personal channel.
   *
   * Deliberately redundant with the thread channel above: that one is a
   * presence channel and needs its own authorisation to come up, so this is
   * what still delivers the message if it does not. Both paths land in
   * `upsertLine`, which is keyed on the message id and ignores the second copy.
   */
  const onInbox = useCallback(
    (event: InboxEvent) => {
      if (event.conversation.id !== conversationId) return;

      setThread(event.conversation);

      if (!event.message) return;

      upsertLine(event.message);

      if (event.message.senderClerkId !== viewerClerkId && !document.hidden) {
        void markRead();
      }
    },
    [conversationId, markRead, upsertLine, viewerClerkId],
  );

  useChannel(viewerClerkId ? userChannel(viewerClerkId) : null, {
    [CHAT_EVENTS.inbox]: onInbox as (data: never) => void,
  });

  /* ---------------------------------------------------------------- *
   * Fallbacks
   * ---------------------------------------------------------------- */

  // No socket: pull the thread on a timer so the chat still works.
  useEffect(() => {
    if (live) return;

    const timer = setInterval(() => {
      if (document.hidden) return;

      void fetch(`/api/chat/conversations/${conversationId}/messages`, {
        cache: "no-store",
      })
        .then((response) => response.json() as Promise<MessagesResponse>)
        .then((payload) => {
          if (!payload.ok) return;

          applyServerPage(payload.items);
          absorb(payload.conversation);

          if (payload.conversation.unread > 0) void markRead();
        })
        .catch(() => {
          // The next tick tries again.
        });
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [live, conversationId, absorb, applyServerPage, markRead]);

  // Coming back to the tab clears the badge on whatever is already open.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void markRead();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  if (!thread) {
    return (
      <div className="grid h-full place-items-center gradient-mist px-6 text-center">
        {threadError ? (
          <p className="max-w-sm rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {threadError}
          </p>
        ) : (
          <Loader2 className="size-5 animate-spin text-leaf" />
        )}
      </div>
    );
  }

  return (
    <>
      <ThreadHeader
        conversation={thread}
        inThread={inThread.includes(thread.partner.clerkId)}
        online={online.has(thread.partner.clerkId)}
        live={live}
        onBack={onBack}
      />

      {threadError ? (
        <p className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {threadError}
        </p>
      ) : null}

      <MessageList
        lines={lines}
        viewerClerkId={viewerClerkId}
        partner={thread.partner}
        {...(thread.partnerReadAt ? { partnerReadAt: thread.partnerReadAt } : {})}
        typingName={typingName}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => void loadEarlier()}
        onRetry={(line) => void send(line.body, line)}
      />

      <MessageComposer
        disabled={!viewerClerkId}
        sending={sending}
        error={sendError}
        suggestions={
          lines.length === 0
            ? thread.viewerRole === "farmer"
              ? FARMER_OPENERS
              : FACTORY_OPENERS
            : []
        }
        onSend={(body) => void send(body)}
        onTyping={announceTyping}
      />
    </>
  );
};

export default ChatThread;
