import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  CHAT_EVENTS,
  threadChannel,
  userChannel,
  type ChatFailure,
  type InboxEvent,
  type ReadEvent,
  type ReadReceiptSuccess,
} from "@/lib/chat";
import {
  hydrateConversation,
  requireThread,
  totalUnreadFor,
} from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";
import Conversation, { type IConversation } from "@/lib/models/Conversation";
import { broadcast } from "@/lib/pusher.server";

/**
 * Marks a thread read for whoever is looking at it.
 *
 * Separate from the message read because only the client knows whether the
 * window is actually in front of someone: a thread fetched into a background
 * tab is not a thread that has been read.
 *
 * The mark goes out twice. On the thread channel it turns the other side's
 * ticks blue; on the reader's own channel it clears the badge in their other
 * tabs.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: ChatFailure) {
  return NextResponse.json(body, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to read this conversation.",
    });
  }

  const { id } = await params;

  try {
    await connectDB();

    const access = await requireThread(id, userId);

    if (!access.ok) return fail(access.status, { ok: false, error: access.error });

    const readAt = new Date();

    const updated = await Conversation.findOneAndUpdate(
      { _id: access.conversation._id },
      {
        $set:
          access.role === "farmer"
            ? { farmerReadAt: readAt, farmerUnread: 0 }
            : { factoryReadAt: readAt, factoryUnread: 0 },
      },
      { new: true },
    ).lean<IConversation | null>();

    const current = updated ?? access.conversation;

    const receipt: ReadEvent = {
      clerkId: userId,
      readAt: readAt.toISOString(),
    };

    const inbox: InboxEvent = {
      conversation: await hydrateConversation(current, userId),
      totalUnread: await totalUnreadFor(userId),
    };

    await Promise.all([
      broadcast(threadChannel(String(current._id)), CHAT_EVENTS.read, receipt),
      broadcast(userChannel(userId), CHAT_EVENTS.inbox, inbox),
    ]);

    const body: ReadReceiptSuccess = {
      ok: true,
      readAt: readAt.toISOString(),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[chat] Could not mark the thread read", error);

    return fail(503, {
      ok: false,
      error: "The conversation could not be marked read right now.",
    });
  }
}
