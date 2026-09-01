import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import {
  CHAT_LIMITS,
  type ChatFailure,
  type ConversationsSuccess,
  type StartConversationInput,
  type StartConversationSuccess,
} from "@/lib/chat";
import {
  hydrateConversation,
  hydrateConversations,
  openThread,
  totalUnreadFor,
} from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";
import Conversation, { type IConversation } from "@/lib/models/Conversation";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";
import User from "@/lib/models/User";

/**
 * The viewer's chat threads, and the endpoint the two Chat buttons land on.
 *
 * GET is one indexed read over `participants`, so the same route serves both
 * sides of the trade without knowing which one is asking. It lists only
 * threads somebody has actually spoken in: pressing Chat opens a room, and a
 * room nobody has said anything in is not a conversation. That keeps the list
 * to people you have really talked to, and it means a mill browsing the
 * marketplace cannot put itself in a farmer's message list just by clicking.
 * The only way into someone's list is to send them something.
 *
 * POST is what makes the buttons work. Neither screen knows whether a thread
 * already exists, and neither should: the farmer's offers inbox sends the
 * offer id, the factory's marketplace card sends the listing id, and both land
 * on the same conversation. The counterparty is taken from the row that was
 * named rather than from the request, so nobody can open a thread with someone
 * they are not trading with.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: ChatFailure) {
  return NextResponse.json(body, { status });
}

const GONE: ChatFailure = {
  ok: false,
  error: "That trade is no longer on the marketplace.",
};

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to read your messages.",
    });
  }

  try {
    await connectDB();

    const rows = await Conversation.find({
      participants: userId,
      // The gate: a room with nothing said in it is not a conversation, and
      // does not belong in anybody's list — not even the person who opened it.
      lastMessageAt: { $ne: null },
    })
      .sort({ lastMessageAt: -1 })
      .limit(CHAT_LIMITS.inboxSize)
      .lean<IConversation[]>();

    const [items, totalUnread] = await Promise.all([
      hydrateConversations(rows, userId),
      totalUnreadFor(userId),
    ]);

    const body: ConversationsSuccess = { ok: true, items, totalUnread };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[chat] Could not read the inbox", error);

    return fail(503, {
      ok: false,
      error: "Your messages could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to start a chat.",
    });
  }

  let payload: StartConversationInput;

  try {
    payload = (await request.json()) as StartConversationInput;
  } catch {
    return fail(400, { ok: false, error: "The request could not be read." });
  }

  const offerId = typeof payload.offerId === "string" ? payload.offerId : "";
  const listingId =
    typeof payload.listingId === "string" ? payload.listingId : "";

  if (!offerId && !listingId) {
    return fail(422, {
      ok: false,
      error: "Open a chat from a harvest listing or from an offer.",
    });
  }

  try {
    await connectDB();

    let farmerClerkId: string;
    let factoryClerkId: string;
    let listing: string;
    let offer: string | undefined;

    if (offerId) {
      if (!isValidObjectId(offerId)) return fail(404, GONE);

      const row = await Offer.findById(offerId)
        .select("listing farmerClerkId factoryClerkId")
        .lean<IOffer | null>();

      if (!row) return fail(404, { ok: false, error: "That offer no longer exists." });

      // Either side of the offer may open the thread; anyone else is told the
      // offer does not exist rather than that it belongs to someone else.
      if (row.farmerClerkId !== userId && row.factoryClerkId !== userId) {
        return fail(404, { ok: false, error: "That offer no longer exists." });
      }

      farmerClerkId = row.farmerClerkId;
      factoryClerkId = row.factoryClerkId;
      listing = String(row.listing);
      offer = String(row._id);
    } else {
      if (!isValidObjectId(listingId)) return fail(404, GONE);

      const row = await Listing.findById(listingId)
        .select("clerkId")
        .lean<IListing | null>();

      if (!row) return fail(404, GONE);

      if (row.clerkId === userId) {
        return fail(403, {
          ok: false,
          error: "This is your own harvest — offers on it arrive in your inbox.",
        });
      }

      const buyer = await User.findOne({ clerkId: userId })
        .select("role")
        .lean<{ role?: string } | null>();

      if (buyer?.role !== "factory") {
        return fail(403, {
          ok: false,
          error: "Only factory accounts can start a chat from the marketplace.",
        });
      }

      farmerClerkId = row.clerkId;
      factoryClerkId = userId;
      listing = String(row._id);

      // A mill that has already bid should see the price in the thread header,
      // even though it opened the chat from the listing rather than the offer.
      const standing = await Offer.findOne({
        listing: row._id,
        factoryClerkId: userId,
      })
        .select("_id")
        .lean<{ _id: unknown } | null>();

      if (standing) offer = String(standing._id);
    }

    const { conversation, created } = await openThread({
      listingId: listing,
      farmerClerkId,
      factoryClerkId,
      ...(offer ? { offerId: offer } : {}),
    });

    const body: StartConversationSuccess = {
      ok: true,
      conversation: await hydrateConversation(conversation, userId),
      created,
    };

    // Nothing is broadcast here on purpose. Opening a room is not news for the
    // other side — they hear about the thread when the first message lands in
    // it, which is also when it starts appearing in their list.

    return NextResponse.json(body, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("[chat] Could not open the conversation", error);

    return fail(503, {
      ok: false,
      error: "The chat could not be opened right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
