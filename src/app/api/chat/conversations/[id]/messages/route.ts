import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  CHAT_EVENTS,
  CHAT_LIMITS,
  normaliseMessageBody,
  threadChannel,
  userChannel,
  type ChatFailure,
  type InboxEvent,
  type MessagesSuccess,
  type SendMessageSuccess,
} from "@/lib/chat";
import {
  hydrateConversation,
  readThreadPage,
  requireThread,
  toChatMessage,
  totalUnreadFor,
} from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";
import Conversation, { type IConversation } from "@/lib/models/Conversation";
import Message, { type IMessage } from "@/lib/models/Message";
import { broadcast } from "@/lib/pusher.server";

/**
 * The lines in one thread.
 *
 * GET is a plain read — opening a thread does not mark it read, because the
 * client is the only thing that knows whether the window is actually in front
 * of someone; that is what the `read` route is for.
 *
 * POST persists first and broadcasts second, and never fails on the broadcast.
 * The message exists once the write returns; realtime delivery is how it
 * arrives quickly, not how it arrives at all, so a tab that missed an event
 * still sees everything on its next read.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: ChatFailure) {
  return NextResponse.json(body, { status });
}

export async function GET(
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
  const search = new URL(request.url).searchParams;

  const rawLimit = Number(search.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), CHAT_LIMITS.maxPageSize)
      : CHAT_LIMITS.pageSize;

  // Paging back through history: everything strictly older than this stamp.
  const rawBefore = search.get("before");
  const before = rawBefore ? new Date(rawBefore) : undefined;

  try {
    await connectDB();

    const access = await requireThread(id, userId);

    if (!access.ok) return fail(access.status, { ok: false, error: access.error });

    const [page, conversation] = await Promise.all([
      readThreadPage(
        access.conversation._id,
        limit,
        before && !Number.isNaN(before.getTime()) ? before : undefined,
      ),
      hydrateConversation(access.conversation, userId),
    ]);

    const body: MessagesSuccess = {
      ok: true,
      conversation,
      items: page.items,
      hasMore: page.hasMore,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[chat] Could not read the thread", error);

    return fail(503, {
      ok: false,
      error: "This conversation could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to send a message.",
    });
  }

  const { id } = await params;

  let payload: { body?: unknown; clientId?: unknown };

  try {
    payload = (await request.json()) as { body?: unknown; clientId?: unknown };
  } catch {
    return fail(400, { ok: false, error: "The message could not be read." });
  }

  const text = normaliseMessageBody(payload.body);

  if (!text) {
    return fail(422, { ok: false, error: "Write something before sending." });
  }

  const clientId =
    typeof payload.clientId === "string"
      ? payload.clientId.slice(0, 64)
      : undefined;

  try {
    await connectDB();

    const access = await requireThread(id, userId);

    if (!access.ok) return fail(access.status, { ok: false, error: access.error });

    const { conversation, role } = access;
    const partnerClerkId =
      role === "farmer" ? conversation.factoryClerkId : conversation.farmerClerkId;

    const saved = await Message.create({
      conversation: conversation._id,
      senderClerkId: userId,
      body: text,
      ...(clientId ? { clientId } : {}),
    });

    const message = toChatMessage(saved.toObject() as IMessage);
    const sentAt = new Date(message.createdAt);

    // The sender has by definition read their own line, so their own mark
    // moves with it — otherwise their unread count would climb in a tab they
    // are actively typing in.
    const moved = await Conversation.findOneAndUpdate(
      { _id: conversation._id },
      {
        $set: {
          lastMessageBody: text,
          lastMessageSenderClerkId: userId,
          lastMessageAt: sentAt,
          ...(role === "farmer"
            ? { farmerReadAt: sentAt, farmerUnread: 0 }
            : { factoryReadAt: sentAt, factoryUnread: 0 }),
        },
        $inc: role === "farmer" ? { factoryUnread: 1 } : { farmerUnread: 1 },
      },
      { new: true },
    ).lean<IConversation | null>();

    const current = moved ?? conversation;

    const [forPartner, partnerTotal, forSender, senderTotal] = await Promise.all([
      hydrateConversation(current, partnerClerkId),
      totalUnreadFor(partnerClerkId),
      hydrateConversation(current, userId),
      totalUnreadFor(userId),
    ]);

    const partnerEvent: InboxEvent = {
      conversation: forPartner,
      message,
      totalUnread: partnerTotal,
    };

    const senderEvent: InboxEvent = {
      conversation: forSender,
      message,
      totalUnread: senderTotal,
    };

    await Promise.all([
      // Anyone with the thread open — including the sender's other tabs, which
      // dedupe on the message id.
      broadcast(threadChannel(String(conversation._id)), CHAT_EVENTS.message, message),
      broadcast(userChannel(partnerClerkId), CHAT_EVENTS.inbox, partnerEvent),
      broadcast(userChannel(userId), CHAT_EVENTS.inbox, senderEvent),
    ]);

    const body: SendMessageSuccess = { ok: true, message };

    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    console.error("[chat] Could not send the message", error);

    return fail(503, {
      ok: false,
      error: "The message could not be sent right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
