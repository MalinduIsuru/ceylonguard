"use client";

import { CircleX, Loader2, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHAT_LIMITS, TYPING_PING_MS, TYPING_TIMEOUT_MS } from "@/lib/chat";

/**
 * The composer.
 *
 * Typing is announced at most once every couple of seconds rather than on
 * every keystroke, and retracted once the keys stop — the receiver drops the
 * flag on a timer of its own too, so a tab that closes mid-sentence does not
 * leave the other side watching dots forever.
 *
 * Enter sends and Shift+Enter breaks the line, which is what everyone expects
 * from a chat box; the hint under the field says so once there is something to
 * send.
 */

type Props = {
  disabled: boolean;
  sending: boolean;
  error: string | null;
  /** Openers offered while the thread is still empty. */
  suggestions: string[];
  onSend: (body: string) => void;
  onTyping: (typing: boolean) => void;
};

const MessageComposer = ({
  disabled,
  sending,
  error,
  suggestions,
  onSend,
  onTyping,
}: Props) => {
  const [draft, setDraft] = useState("");

  const field = useRef<HTMLTextAreaElement | null>(null);
  /** When the last "still typing" ping went out. */
  const pingedAt = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (idle.current) {
      clearTimeout(idle.current);
      idle.current = null;
    }

    if (pingedAt.current !== 0) {
      pingedAt.current = 0;
      onTyping(false);
    }
  }, [onTyping]);

  // Leaving the thread mid-sentence should not leave the flag standing.
  useEffect(() => stopTyping, [stopTyping]);

  const announce = useCallback(() => {
    const now = Date.now();

    if (now - pingedAt.current > TYPING_PING_MS) {
      pingedAt.current = now;
      onTyping(true);
    }

    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(stopTyping, TYPING_TIMEOUT_MS);
  }, [onTyping, stopTyping]);

  const send = useCallback(
    (body: string) => {
      const text = body.trim();

      if (!text || disabled) return;

      stopTyping();
      setDraft("");
      onSend(text);

      field.current?.focus();
    },
    [disabled, onSend, stopTyping],
  );

  const remaining = CHAT_LIMITS.maxBodyLength - draft.length;

  return (
    <div className="shrink-0 border-t border-border/70 bg-white/90 px-4 py-3 backdrop-blur">
      {error ? (
        <p className="mb-2 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-800">
          <CircleX className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {draft.length === 0 && suggestions.length > 0 ? (
        <div className="chat-scroll mb-2 flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={disabled}
              onClick={() => send(suggestion)}
              className="shrink-0 cursor-pointer rounded-full border border-leaf/30 bg-leaf-soft/60 px-3 py-1.5 text-xs font-medium text-leaf-strong transition-colors hover:bg-leaf-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <Textarea
          ref={field}
          rows={1}
          value={draft}
          disabled={disabled}
          maxLength={CHAT_LIMITS.maxBodyLength}
          placeholder="Write a message…"
          aria-label="Message"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl bg-secondary/50 px-4 py-3 text-sm"
          onChange={(event) => {
            setDraft(event.target.value);

            if (event.target.value.trim()) announce();
            else stopTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
        />

        <Button
          type="submit"
          variant="hero"
          size="icon"
          className="size-11 shrink-0 rounded-2xl"
          disabled={disabled || sending || draft.trim().length === 0}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </Button>
      </form>

      <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>{draft.trim() ? "Enter to send · Shift + Enter for a new line" : ""}</span>
        {remaining < 200 ? <span>{remaining} left</span> : null}
      </div>
    </div>
  );
};

export default MessageComposer;
