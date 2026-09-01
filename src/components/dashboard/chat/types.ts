import type { ChatMessage } from "@/lib/chat";

/**
 * A message as the thread draws it, which is not quite a message as the server
 * knows one: a line exists on screen from the moment it is sent, and carries
 * its own delivery state until the server confirms it.
 */
export type ThreadLine = ChatMessage & {
  /** Between pressing send and the server answering. */
  pending?: boolean;
  /** The send failed; the line stays on screen so it can be retried. */
  failed?: boolean;
};
