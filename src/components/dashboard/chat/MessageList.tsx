"use client";

import {
  AlertCircle,
  ArrowDown,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import PartnerAvatar from "@/components/dashboard/chat/PartnerAvatar";
import type { ThreadLine } from "@/components/dashboard/chat/types";
import { Button } from "@/components/ui/button";
import {
  formatDayLabel,
  formatMessageTime,
  sameGroup,
  startsNewDay,
  type ChatParticipant,
} from "@/lib/chat";

/**
 * The thread itself.
 *
 * Scroll position is the whole trick here. A message arriving while you are
 * reading back through history must not yank you to the bottom, so the list
 * only follows new messages when it was already at the bottom, and otherwise
 * raises the pill.
 *
 * Both pieces of scroll state are written by the scroll handler and nowhere
 * else. `jump` only touches the DOM; the smooth scroll it starts ends in a
 * scroll event, which is what actually records that the bottom has been seen.
 * The component is mounted per conversation, so switching threads resets all
 * of this by remounting rather than by clearing it.
 */

type Props = {
  lines: ThreadLine[];
  viewerClerkId: string;
  partner: ChatParticipant;
  /** ISO 8601 — everything the partner sent before this is read. */
  partnerReadAt?: string;
  /** Name of whoever is typing, or null. */
  typingName: string | null;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: (line: ThreadLine) => void;
};

/** Within this many pixels of the bottom still counts as "at the bottom". */
const STICK_THRESHOLD = 120;

const MessageList = ({
  lines,
  viewerClerkId,
  partner,
  partnerReadAt,
  typingName,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onRetry,
}: Props) => {
  const scroller = useRef<HTMLDivElement | null>(null);

  const [pinned, setPinned] = useState(true);
  /** When the bottom of the thread was last actually on screen. */
  const [seenAt, setSeenAt] = useState(() => Date.now());

  const jump = useCallback((behavior: ScrollBehavior) => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior,
    });
  }, []);

  const onScroll = useCallback(() => {
    const node = scroller.current;

    if (!node) return;

    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distance < STICK_THRESHOLD;

    setPinned(atBottom);
    if (atBottom) setSeenAt(Date.now());
  }, []);

  // The thread opens at its newest message, with no animation: a smooth
  // scroll through a thread that has only just rendered reads as a glitch.
  useEffect(() => {
    const node = scroller.current;

    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  const count = lines.length;
  const newest = lines[count - 1];
  const newestId = newest?.id;
  const newestIsMine = newest?.senderClerkId === viewerClerkId;

  // `pinned` is read by the effect below but must not be a dependency of it:
  // that effect follows a message arriving, not the reader scrolling around.
  const stuckToBottom = useRef(pinned);

  useEffect(() => {
    stuckToBottom.current = pinned;
  }, [pinned]);

  useEffect(() => {
    if (!newestId) return;

    // Your own message always pulls the view down; someone else's only does
    // when you were already reading the bottom of the thread.
    if (stuckToBottom.current || newestIsMine) jump("smooth");
  }, [newestId, newestIsMine, jump]);

  // The typing bubble adds height; follow it only if already at the bottom.
  useEffect(() => {
    if (typingName && stuckToBottom.current) jump("smooth");
  }, [typingName, jump]);

  const readCutoff = partnerReadAt ? new Date(partnerReadAt).getTime() : 0;

  /** Messages from the other side that landed below the fold. */
  const missed = pinned
    ? 0
    : lines.filter(
        (line) =>
          line.senderClerkId !== viewerClerkId &&
          new Date(line.createdAt).getTime() > seenAt,
      ).length;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="chat-scroll h-full overflow-y-auto gradient-mist px-4 py-5"
      >
        {hasMore ? (
          <div className="mb-4 grid place-items-center">
            <Button
              variant="leafOutline"
              size="sm"
              onClick={onLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Clock className="size-3.5" />
              )}
              Load earlier messages
            </Button>
          </div>
        ) : null}

        {loading && count === 0 ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="size-5 animate-spin text-leaf" />
          </div>
        ) : null}

        {!loading && count === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div className="grid justify-items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-leaf-soft">
                <MessageCircle className="size-6 text-leaf-strong" />
              </span>
              <p className="font-display text-base font-bold text-leaf-strong">
                Say hello to {partner.name}
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Agree on the price, the pickup day and the quantity here.
                Messages are delivered the moment they are sent.
              </p>
            </div>
          </div>
        ) : null}

        <ol className="grid gap-1">
          {lines.map((line, index) => {
            const previous = lines[index - 1];
            const next = lines[index + 1];

            const mine = line.senderClerkId === viewerClerkId;
            const grouped = sameGroup(previous, line);
            const tail = !next || !sameGroup(line, next);
            const newDay = startsNewDay(previous, line);

            const read =
              mine &&
              !line.pending &&
              !line.failed &&
              readCutoff >= new Date(line.createdAt).getTime();

            return (
              <li key={line.id} className="grid gap-1">
                {newDay ? (
                  <div className="my-3 grid place-items-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-soft">
                      {formatDayLabel(line.createdAt)}
                    </span>
                  </div>
                ) : null}

                <div
                  className={`flex items-end gap-2 ${
                    mine ? "justify-end" : "justify-start"
                  } ${grouped ? "mt-0.5" : "mt-2"}`}
                >
                  {!mine ? (
                    tail ? (
                      <PartnerAvatar participant={partner} size="sm" />
                    ) : (
                      <span className="size-9 shrink-0" aria-hidden="true" />
                    )
                  ) : null}

                  <div
                    className={`max-w-[min(78%,34rem)] animate-pop px-4 py-2.5 shadow-soft ${
                      mine
                        ? `gradient-leaf text-white ${
                            tail
                              ? "rounded-3xl rounded-br-md"
                              : "rounded-3xl rounded-br-xl"
                          } ${line.failed ? "opacity-70 saturate-50" : ""}`
                        : `bg-white text-foreground ring-1 ring-border ${
                            tail
                              ? "rounded-3xl rounded-bl-md"
                              : "rounded-3xl rounded-bl-xl"
                          }`
                    }`}
                  >
                    <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                      {line.body}
                    </p>

                    {tail || line.pending || line.failed ? (
                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-white/75" : "text-muted-foreground"
                        }`}
                      >
                        {line.failed ? (
                          <>
                            <AlertCircle className="size-3" /> Not sent
                          </>
                        ) : (
                          <>
                            {formatMessageTime(line.createdAt)}
                            {mine ? (
                              line.pending ? (
                                <Clock
                                  className="size-3"
                                  aria-label="Sending"
                                />
                              ) : read ? (
                                <CheckCheck
                                  className="size-3.5 text-white"
                                  aria-label="Read"
                                />
                              ) : (
                                <Check
                                  className="size-3.5"
                                  aria-label="Sent"
                                />
                              )
                            ) : null}
                          </>
                        )}
                      </p>
                    ) : null}
                  </div>

                  {line.failed ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() => onRetry(line)}
                      aria-label="Send again"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {typingName ? (
          <div className="mt-3 flex items-end gap-2">
            <PartnerAvatar participant={partner} size="sm" />
            <div className="flex items-center gap-1 rounded-3xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-border">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-typing rounded-full bg-leaf"
                  style={{ animationDelay: `${dot * 0.15}s` }}
                />
              ))}
              <span className="sr-only">{typingName} is typing</span>
            </div>
          </div>
        ) : null}
      </div>

      {!pinned && count > 0 ? (
        <button
          type="button"
          onClick={() => jump("smooth")}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full gradient-leaf px-4 py-2 text-xs font-semibold text-white shadow-(--shadow-leaf) transition-transform hover:scale-105"
        >
          <ArrowDown className="size-3.5" />
          {missed > 0
            ? `${missed} new message${missed === 1 ? "" : "s"}`
            : "Jump to latest"}
        </button>
      ) : null}
    </div>
  );
};

export default MessageList;
