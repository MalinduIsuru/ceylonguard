import type { ListingStatus } from "@/lib/models/Listing";
import type { OfferStatus } from "@/lib/models/Offer";

/**
 * Shared contract between the chat routes, the realtime channels and the chat
 * workspace.
 *
 * A conversation is always described from the point of view of whoever asked
 * for it: `partner` is the other side of the trade and `unread` is the
 * viewer's own count, so the client never has to work out which of two clerk
 * ids belongs to it.
 */

export type ChatRole = "farmer" | "factory";

export type ChatParticipant = {
  clerkId: string;
  /** Mill name for a factory, person's name for a farmer. */
  name: string;
  role: ChatRole;
  imageUrl?: string;
  district?: string;
  phone?: string;
};

/** The harvest the thread is about, as it stands today. */
export type ChatListingContext = {
  id: string;
  district: string;
  weightKg: number;
  pricePerKg: number;
  /** Calendar day as `YYYY-MM-DD`. */
  harvestDate: string;
  status: ListingStatus;
};

/** The offer on the table, when the thread was opened off one. */
export type ChatOfferContext = {
  id: string;
  pricePerKg: number;
  askingPricePerKg: number;
  weightKg: number;
  status: OfferStatus;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderClerkId: string;
  body: string;
  /** ISO 8601. */
  createdAt: string;
  /** Echoed back so the sending tab can match its optimistic line. */
  clientId?: string;
};

export type ChatConversation = {
  id: string;
  /** The other side of the trade, as this viewer sees them. */
  partner: ChatParticipant;
  /** Which side of the trade the viewer is on. */
  viewerRole: ChatRole;

  listing?: ChatListingContext;
  offer?: ChatOfferContext;

  /**
   * The newest line, and the gate on being listed at all: a thread nobody has
   * spoken in is a room the Chat button opened, not a conversation, and it
   * stays out of both sides' lists until someone says something.
   */
  lastMessage?: ChatMessage;
  /** Messages the viewer has not opened yet. */
  unread: number;
  /** ISO 8601 — when the partner last opened the thread, drives receipts. */
  partnerReadAt?: string;
  /** ISO 8601 — last message, else when the thread was opened. */
  updatedAt: string;
};

export type ChatFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type ConversationsSuccess = {
  ok: true;
  /** The viewer's threads, most recently spoken in first. */
  items: ChatConversation[];
  /** Unread messages across every thread — what the sidebar badge shows. */
  totalUnread: number;
};

export type ConversationsResponse = ConversationsSuccess | ChatFailure;

export type StartConversationSuccess = {
  ok: true;
  conversation: ChatConversation;
  /** False when the thread was already open. */
  created: boolean;
};

export type StartConversationResponse = StartConversationSuccess | ChatFailure;

/** What the chat buttons send: whichever id the screen they sit on knows. */
export type StartConversationInput = {
  /** From the factory's marketplace card. */
  listingId?: string;
  /** From the farmer's offers inbox. */
  offerId?: string;
};

export type MessagesSuccess = {
  ok: true;
  /** The thread itself, so opening it is one request rather than two. */
  conversation: ChatConversation;
  /** Oldest first, ready to render. */
  items: ChatMessage[];
  /** True when there is older history behind `items`. */
  hasMore: boolean;
};

export type MessagesResponse = MessagesSuccess | ChatFailure;

export type SendMessageSuccess = {
  ok: true;
  message: ChatMessage;
};

export type SendMessageResponse = SendMessageSuccess | ChatFailure;

export type ReadReceiptSuccess = {
  ok: true;
  /** ISO 8601 — the mark that was written. */
  readAt: string;
};

export type ReadReceiptResponse = ReadReceiptSuccess | ChatFailure;

export const CHAT_LIMITS = {
  maxBodyLength: 2000,
  /** How many messages a thread opens with, and pages back by. */
  pageSize: 40,
  maxPageSize: 100,
  /** Threads shown in the list; more than this and it wants paging. */
  inboxSize: 60,
} as const;

/* ------------------------------------------------------------------ *
 * Realtime channels and events
 * ------------------------------------------------------------------ */

/**
 * The thread channel is a presence channel rather than a private one: the
 * membership list is exactly "who has this thread open", which is what the
 * header's live dot reports. Typing and read marks ride the same channel
 * because they only interest someone already looking at it.
 */
export function threadChannel(conversationId: string): string {
  return `presence-chat-${conversationId}`;
}

/**
 * Per-person channel. Carries thread-level news — a new message in a thread
 * that is not on screen — so the conversation list and the sidebar badge stay
 * live without polling.
 */
export function userChannel(clerkId: string): string {
  return `private-user-${clerkId}`;
}

/**
 * One channel for the whole app, joined by anyone with a dashboard page open.
 *
 * Membership here means "reachable right now", which is what an online dot in
 * a conversation list has to mean — `threadChannel` reports the much narrower
 * "is looking at this one thread", and a list built on that would show
 * everyone offline almost always. The thread header uses both: the narrow
 * signal when it has it, this one otherwise.
 *
 * Nothing but the clerk id is published to it. Every subscriber can see the
 * membership list, so names and photos stay on the conversations that already
 * carry them, where the viewer has a reason to see them.
 *
 * Note the ceiling: Pusher caps a presence channel at 100 concurrent members.
 * Past that, later subscriptions fail and those people simply read as offline,
 * which is the right way for this to degrade but is not a roster any more.
 */
export const PRESENCE_CHANNEL = "presence-online";

export const CHAT_EVENTS = {
  /** Thread channel: a new line was posted. Payload: `ChatMessage`. */
  message: "chat:message",
  /** Thread channel: someone is typing. Payload: `TypingEvent`. */
  typing: "chat:typing",
  /** Thread channel: someone opened the thread. Payload: `ReadEvent`. */
  read: "chat:read",
  /** User channel: a thread of mine moved. Payload: `InboxEvent`. */
  inbox: "chat:inbox",
} as const;

export type TypingEvent = {
  clerkId: string;
  name: string;
  /** False when the composer was emptied before anything was sent. */
  typing: boolean;
};

export type ReadEvent = {
  clerkId: string;
  /** ISO 8601. */
  readAt: string;
};

export type InboxEvent = {
  /** The thread as the recipient now sees it, ready to slot into the list. */
  conversation: ChatConversation;
  /** The line that moved it, absent when only a read mark changed. */
  message?: ChatMessage;
  /** The recipient's unread count across every thread. */
  totalUnread: number;
};

/** How long a typing flag stands before the receiver drops it by itself. */
export const TYPING_TIMEOUT_MS = 3500;

/** How often a still-typing composer re-announces itself. */
export const TYPING_PING_MS = 2000;

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

/** Trims and caps a composed message; empty means "nothing to send". */
export function normaliseMessageBody(value: unknown): string {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, CHAT_LIMITS.maxBodyLength);
}

/** Initials for the avatar fallback, at most two letters. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** `14:05` — the stamp under a bubble. */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "Today" / "Yesterday" / "12 Mar 2026" — the separator between days. */
export function formatDayLabel(iso: string): string {
  const day = new Date(iso);
  const midnight = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const days = Math.round((midnight(new Date()) - midnight(day)) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return day.toLocaleDateString("en-LK", { weekday: "long" });

  return day.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Relative age for the conversation list, where space is one line. */
export function formatThreadAge(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();

  if (elapsed < 60_000) return "now";

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(iso).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
  });
}

/** True when two messages should be drawn as one stacked group. */
export function sameGroup(
  previous: ChatMessage | undefined,
  message: ChatMessage,
): boolean {
  if (!previous) return false;
  if (previous.senderClerkId !== message.senderClerkId) return false;

  const gap =
    new Date(message.createdAt).getTime() -
    new Date(previous.createdAt).getTime();

  // Five minutes: long enough that a back-and-forth stays one block, short
  // enough that picking the thread up again reads as a new turn.
  return gap >= 0 && gap < 300_000;
}

/** True when the two messages fall on different calendar days. */
export function startsNewDay(
  previous: ChatMessage | undefined,
  message: ChatMessage,
): boolean {
  if (!previous) return true;

  return (
    new Date(previous.createdAt).toDateString() !==
    new Date(message.createdAt).toDateString()
  );
}

/**
 * Where a chat button lands.
 *
 * The button does not open the thread itself — it names the trade and lets the
 * chat page resolve it, so both sides can keep using a plain link and neither
 * screen has to know whether a conversation already exists.
 */
export function chatHrefForOffer(offerId: string): string {
  return `/dashboard/chat?offer=${offerId}`;
}

export function chatHrefForListing(listingId: string): string {
  return `/dashboard/chat?listing=${listingId}`;
}
