"use client";

import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import PartnerAvatar from "@/components/dashboard/chat/PartnerAvatar";
import { formatThreadAge, type ChatConversation } from "@/lib/chat";

/**
 * The left rail: every trade this account is actually talking about.
 *
 * A thread appears here once somebody has spoken in it, and not before —
 * pressing Chat opens a room, and an empty room is not a conversation. The
 * server filters those out; the check below catches the one case the server
 * cannot, which is the room this browser has just opened and is looking at.
 *
 * Rows are ordered by the server and never re-sorted here, so a thread that
 * moves to the top does so because a message actually landed in it. The search
 * box is a local filter over what is already loaded — the inbox is capped well
 * below the point where that stops being enough.
 */

type Props = {
  conversations: ChatConversation[];
  activeId: string | null;
  loading: boolean;
  viewerClerkId: string;
  /** Clerk ids with CeylonGuard open, which is what the dots read. */
  online: ReadonlySet<string>;
  onSelect: (id: string) => void;
};

const ConversationList = ({
  conversations,
  activeId,
  loading,
  viewerClerkId,
  online,
  onSelect,
}: Props) => {
  const [query, setQuery] = useState("");

  /** Threads that have been spoken in. Everything else is not a conversation. */
  const started = useMemo(
    () => conversations.filter((thread) => Boolean(thread.lastMessage)),
    [conversations],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return started;

    return started.filter((thread) =>
      [thread.partner.name, thread.listing?.district, thread.lastMessage?.body]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [started, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/70 px-4 py-4">
        <h1 className="font-display text-lg font-bold text-leaf-strong">
          Messages
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          One thread per harvest you are trading on.
        </p>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 rounded-full pl-9"
            placeholder="Search people or districts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {loading && conversations.length === 0
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex animate-pulse items-center gap-3 rounded-2xl p-3"
              >
                <div className="size-11 shrink-0 rounded-full bg-secondary" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded-full bg-secondary" />
                  <div className="h-2.5 w-full rounded-full bg-secondary/70" />
                </div>
              </div>
            ))
          : null}

        {visible.map((thread) => {
          const active = thread.id === activeId;
          const mine = thread.lastMessage?.senderClerkId === viewerClerkId;

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                active
                  ? "border-leaf/40 bg-leaf-soft shadow-soft"
                  : "border-transparent hover:border-leaf/20 hover:bg-secondary/60"
              }`}
            >
              <PartnerAvatar
                participant={thread.partner}
                online={online.has(thread.partner.clerkId)}
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-leaf-strong">
                    {thread.partner.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatThreadAge(thread.updatedAt)}
                  </span>
                </span>

                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                    {thread.partner.role === "factory" ? "Factory" : "Farmer"}
                  </span>
                  {/* The harvest's district, falling back to where the trader
                      is based once the listing behind the thread is gone. */}
                  <span className="truncate">
                    {thread.listing?.district ??
                      thread.partner.district ??
                      "District not set"}
                  </span>
                </span>

                <span className="mt-1.5 flex items-center justify-between gap-2">
                  <span
                    className={`truncate text-xs ${
                      thread.unread > 0
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {mine ? "You: " : ""}
                    {thread.lastMessage?.body}
                  </span>

                  {thread.unread > 0 ? (
                    <span className="grid min-w-5 shrink-0 place-items-center rounded-full gradient-leaf px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {thread.unread > 99 ? "99+" : thread.unread}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}

        {!loading && visible.length === 0 ? (
          <div className="grid place-items-center gap-2 px-6 py-14 text-center">
            <MessageCircle className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {started.length === 0
                ? "No conversations yet. Press Chat with… on an offer you have received, or on a harvest in the marketplace, and send a message to start one."
                : "No conversation matches that search."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ConversationList;
