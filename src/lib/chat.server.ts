import "server-only";

import { isValidObjectId, type Types } from "mongoose";

import type {
  ChatConversation,
  ChatListingContext,
  ChatMessage,
  ChatOfferContext,
  ChatParticipant,
  ChatRole,
} from "@/lib/chat";
import { toDayString } from "@/lib/listings";
import Conversation, { type IConversation } from "@/lib/models/Conversation";
import Listing, { type IListing } from "@/lib/models/Listing";
import Message, { type IMessage } from "@/lib/models/Message";
import Offer, { type IOffer } from "@/lib/models/Offer";
import User from "@/lib/models/User";

/** Server-side pieces of chat, kept out of the client bundle. */

/** Shown when someone published or bid before filling in their profile. */
const ANONYMOUS = {
  farmer: "CeylonGuard farmer",
  factory: "Tea factory",
} as const;

type UserRow = {
  clerkId: string;
  firstName?: string;
  lastName?: string;
  factoryName?: string;
  district?: string;
  phone?: string;
  imageUrl?: string;
};

/**
 * Names the people on a set of threads.
 *
 * A mill is shown by its mill name and a farmer by their own, which is why the
 * role has to come from the conversation rather than from the profile: a
 * factory account that never onboarded has no `factoryName` to read, and
 * falling back to the account holder's name is better than a blank.
 */
export async function resolveParticipants(
  entries: { clerkId: string; role: ChatRole }[],
): Promise<Map<string, ChatParticipant>> {
  const roles = new Map(entries.map((entry) => [entry.clerkId, entry.role]));
  const clerkIds = [...roles.keys()];

  if (clerkIds.length === 0) return new Map();

  const users = await User.find({ clerkId: { $in: clerkIds } })
    .select("clerkId firstName lastName factoryName district phone imageUrl")
    .lean<UserRow[]>();

  const found = new Map(users.map((user) => [user.clerkId, user]));

  return new Map(
    clerkIds.map((clerkId) => {
      const role = roles.get(clerkId)!;
      const user = found.get(clerkId);
      const personal = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      // `||` rather than `??`: a profile saved as whitespace should fall
      // through to the next name, not read as a mill called "".
      const name =
        (role === "factory" ? user?.factoryName?.trim() || personal : personal) ||
        ANONYMOUS[role];

      return [
        clerkId,
        {
          clerkId,
          name,
          role,
          ...(user?.imageUrl ? { imageUrl: user.imageUrl } : {}),
          ...(user?.district ? { district: user.district } : {}),
          ...(user?.phone ? { phone: user.phone } : {}),
        },
      ];
    }),
  );
}

/** The harvests behind a set of threads, as they stand today. */
export async function resolveListingContexts(
  conversations: IConversation[],
): Promise<Map<string, ChatListingContext>> {
  const ids = [...new Set(conversations.map((row) => String(row.listing)))];

  if (ids.length === 0) return new Map();

  const listings = await Listing.find({ _id: { $in: ids } })
    .select("district weightKg pricePerKg harvestDate status")
    .lean<IListing[]>();

  return new Map(
    listings.map((listing) => [
      String(listing._id),
      {
        id: String(listing._id),
        district: listing.district,
        weightKg: listing.weightKg,
        pricePerKg: listing.pricePerKg,
        harvestDate: toDayString(new Date(listing.harvestDate)),
        status: listing.status,
      },
    ]),
  );
}

/**
 * The offers behind a set of threads, as they stand today.
 *
 * Re-read rather than frozen on the conversation: the header is meant to show
 * what is currently on the table, so a bid that has since been accepted or
 * withdrawn reads that way in the thread it was negotiated in.
 */
export async function resolveOfferContexts(
  conversations: IConversation[],
): Promise<Map<string, ChatOfferContext>> {
  const ids = [
    ...new Set(
      conversations
        .map((row) => (row.offer ? String(row.offer) : null))
        .filter((id): id is string => id !== null),
    ),
  ];

  if (ids.length === 0) return new Map();

  const offers = await Offer.find({ _id: { $in: ids } })
    .select("pricePerKg askingPricePerKg weightKg status")
    .lean<IOffer[]>();

  return new Map(
    offers.map((offer) => [
      String(offer._id),
      {
        id: String(offer._id),
        pricePerKg: offer.pricePerKg,
        askingPricePerKg: offer.askingPricePerKg,
        weightKg: offer.weightKg,
        status: offer.status,
      },
    ]),
  );
}

export function toChatMessage(message: IMessage): ChatMessage {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    senderClerkId: message.senderClerkId,
    body: message.body,
    createdAt: new Date(message.createdAt).toISOString(),
    ...(message.clientId ? { clientId: message.clientId } : {}),
  };
}

/** Which side of the trade a viewer is on, or null if they are neither. */
export function sideOf(
  conversation: IConversation,
  clerkId: string,
): ChatRole | null {
  if (conversation.farmerClerkId === clerkId) return "farmer";
  if (conversation.factoryClerkId === clerkId) return "factory";

  return null;
}

/** Mongo row to the shape one viewer's chat renders. */
export function toChatConversation(
  conversation: IConversation,
  viewerClerkId: string,
  participants: Map<string, ChatParticipant>,
  listings: Map<string, ChatListingContext>,
  offers: Map<string, ChatOfferContext>,
): ChatConversation {
  const viewerRole = sideOf(conversation, viewerClerkId) ?? "farmer";
  const partnerClerkId =
    viewerRole === "farmer"
      ? conversation.factoryClerkId
      : conversation.farmerClerkId;
  const partnerRole: ChatRole = viewerRole === "farmer" ? "factory" : "farmer";

  const partner = participants.get(partnerClerkId) ?? {
    clerkId: partnerClerkId,
    name: ANONYMOUS[partnerRole],
    role: partnerRole,
  };

  const listing = listings.get(String(conversation.listing));
  const offer = conversation.offer
    ? offers.get(String(conversation.offer))
    : undefined;

  const unread =
    viewerRole === "farmer"
      ? conversation.farmerUnread
      : conversation.factoryUnread;
  const partnerReadAt =
    viewerRole === "farmer"
      ? conversation.factoryReadAt
      : conversation.farmerReadAt;

  return {
    id: String(conversation._id),
    partner,
    viewerRole,

    ...(listing ? { listing } : {}),
    ...(offer ? { offer } : {}),

    ...(conversation.lastMessageBody && conversation.lastMessageAt
      ? {
          lastMessage: {
            // The preview is not a message row, so it carries no id of its
            // own; the list only ever reads its body, sender and time.
            id: `${String(conversation._id)}-last`,
            conversationId: String(conversation._id),
            senderClerkId: conversation.lastMessageSenderClerkId ?? "",
            body: conversation.lastMessageBody,
            createdAt: new Date(conversation.lastMessageAt).toISOString(),
          },
        }
      : {}),

    unread: unread ?? 0,
    ...(partnerReadAt
      ? { partnerReadAt: new Date(partnerReadAt).toISOString() }
      : {}),

    updatedAt: new Date(
      conversation.lastMessageAt ?? conversation.updatedAt,
    ).toISOString(),
  };
}

/** A page of threads, with their people, harvests and offers resolved. */
export async function hydrateConversations(
  conversations: IConversation[],
  viewerClerkId: string,
): Promise<ChatConversation[]> {
  if (conversations.length === 0) return [];

  const sides = conversations.flatMap((row) => [
    { clerkId: row.farmerClerkId, role: "farmer" as const },
    { clerkId: row.factoryClerkId, role: "factory" as const },
  ]);

  const [participants, listings, offers] = await Promise.all([
    resolveParticipants(sides),
    resolveListingContexts(conversations),
    resolveOfferContexts(conversations),
  ]);

  return conversations.map((row) =>
    toChatConversation(row, viewerClerkId, participants, listings, offers),
  );
}

/** One thread, resolved. Used after a send, a read, or a start. */
export async function hydrateConversation(
  conversation: IConversation,
  viewerClerkId: string,
): Promise<ChatConversation> {
  const [hydrated] = await hydrateConversations([conversation], viewerClerkId);

  return hydrated!;
}

/** Unread messages across every thread — what the sidebar badge shows. */
export async function totalUnreadFor(clerkId: string): Promise<number> {
  const totals = await Conversation.aggregate<{ _id: null; total: number }>([
    { $match: { participants: clerkId } },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [
              { $eq: ["$farmerClerkId", clerkId] },
              "$farmerUnread",
              "$factoryUnread",
            ],
          },
        },
      },
    },
  ]);

  return totals[0]?.total ?? 0;
}

export type ThreadAccess =
  | { ok: true; conversation: IConversation; role: ChatRole }
  | { ok: false; status: number; error: string };

/**
 * The thread, if the caller is on it.
 *
 * Membership is the whole authorisation model for chat: there is no role gate
 * beyond it, because being named on a conversation is what earns the right to
 * read and write it. A thread someone is not part of reads as "not found"
 * rather than "forbidden", so ids cannot be probed.
 */
export async function requireThread(
  conversationId: string,
  clerkId: string,
): Promise<ThreadAccess> {
  if (!isValidObjectId(conversationId)) {
    return { ok: false, status: 404, error: "That conversation no longer exists." };
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: clerkId,
  }).lean<IConversation | null>();

  if (!conversation) {
    return { ok: false, status: 404, error: "That conversation no longer exists." };
  }

  const role = sideOf(conversation, clerkId);

  if (!role) {
    return { ok: false, status: 404, error: "That conversation no longer exists." };
  }

  return { ok: true, conversation, role };
}

/**
 * Finds the thread for a trade, or opens it.
 *
 * Both sides call this against the same key, so whoever opens the chat first
 * creates the row and the other one joins it. The upsert is the point: two
 * people pressing Chat at the same moment race on the unique index rather than
 * on a read-then-insert, and the loser gets the winner's row back.
 */
export async function openThread(input: {
  listingId: Types.ObjectId | string;
  farmerClerkId: string;
  factoryClerkId: string;
  offerId?: Types.ObjectId | string;
}): Promise<{ conversation: IConversation; created: boolean }> {
  const key = {
    listing: input.listingId,
    farmerClerkId: input.farmerClerkId,
    factoryClerkId: input.factoryClerkId,
  };

  const existing = await Conversation.findOne(key).lean<IConversation | null>();

  if (existing) {
    // A thread opened from a bare listing predates the offer that followed it;
    // attach the offer the first time it is opened from the offers side, so
    // the header can start showing the price under negotiation.
    if (input.offerId && !existing.offer) {
      const updated = await Conversation.findOneAndUpdate(
        { _id: existing._id, offer: { $exists: false } },
        { $set: { offer: input.offerId } },
        { new: true },
      ).lean<IConversation | null>();

      return { conversation: updated ?? existing, created: false };
    }

    return { conversation: existing, created: false };
  }

  try {
    const created = await Conversation.create({
      ...key,
      ...(input.offerId ? { offer: input.offerId } : {}),
      participants: [input.farmerClerkId, input.factoryClerkId],
      farmerUnread: 0,
      factoryUnread: 0,
    });

    return { conversation: created.toObject() as IConversation, created: true };
  } catch (error) {
    // Lost the race on the unique index: the other side created the same
    // thread a moment ago, which is the row we wanted anyway.
    if ((error as { code?: number }).code === 11000) {
      const raced = await Conversation.findOne(key).lean<IConversation | null>();

      if (raced) return { conversation: raced, created: false };
    }

    throw error;
  }
}

/** The newest page of a thread, oldest first, plus whether more sits behind. */
export async function readThreadPage(
  conversationId: Types.ObjectId | string,
  limit: number,
  before?: Date,
): Promise<{ items: ChatMessage[]; hasMore: boolean }> {
  const rows = await Message.find({
    conversation: conversationId,
    ...(before ? { createdAt: { $lt: before } } : {}),
  })
    .sort({ createdAt: -1 })
    // One extra row answers "is there more" without a second count query.
    .limit(limit + 1)
    .lean<IMessage[]>();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.reverse().map(toChatMessage),
    hasMore,
  };
}
