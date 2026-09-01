import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { PRESENCE_CHANNEL } from "@/lib/chat";
import { resolveParticipants, requireThread, sideOf } from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";
import { pusherServer, realtimeConfigured } from "@/lib/pusher.server";

/**
 * Signs a client's subscription to a chat channel.
 *
 * Pusher calls the subscriber trusted once this endpoint has signed for it, so
 * this is the only thing standing between a channel name and someone else's
 * conversation. Both channel families are checked against the signed-in user
 * rather than against anything the client sent:
 *
 *   presence-online          — any signed-in account, id only
 *   private-user-<clerkId>   — has to be the caller's own id
 *   presence-chat-<id>       — the caller has to be named on that thread
 *
 * Anything else is refused outright. The presence payload is built here too,
 * from the database, so a member's name in the "who is here" list is not
 * something the browser got to choose.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_PREFIX = "private-user-";
const THREAD_PREFIX = "presence-chat-";

function deny(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const pusher = pusherServer();

  if (!pusher || !realtimeConfigured) {
    return deny(503, "Realtime messaging is not configured on this server.");
  }

  const { userId } = await auth();

  if (!userId) return deny(401, "You need to be signed in.");

  let socketId = "";
  let channel = "";

  try {
    // Pusher's client posts this form-encoded, not as JSON.
    const form = await request.formData();

    socketId = String(form.get("socket_id") ?? "");
    channel = String(form.get("channel_name") ?? "");
  } catch {
    return deny(400, "The subscription request could not be read.");
  }

  if (!socketId || !channel) {
    return deny(400, "The subscription request was incomplete.");
  }

  // The app-wide roster. Any signed-in account may join, and joining is all
  // it does: the payload carries the clerk id and nothing else, so a member
  // list leaks no names.
  if (channel === PRESENCE_CHANNEL) {
    return NextResponse.json(
      pusher.authorizeChannel(socketId, channel, { user_id: userId }),
    );
  }

  if (channel.startsWith(USER_PREFIX)) {
    if (channel.slice(USER_PREFIX.length) !== userId) {
      return deny(403, "That channel is not yours.");
    }

    return NextResponse.json(pusher.authorizeChannel(socketId, channel));
  }

  if (channel.startsWith(THREAD_PREFIX)) {
    const conversationId = channel.slice(THREAD_PREFIX.length);

    try {
      await connectDB();

      const access = await requireThread(conversationId, userId);

      if (!access.ok) return deny(403, "That conversation is not yours.");

      const role = sideOf(access.conversation, userId)!;
      const participants = await resolveParticipants([{ clerkId: userId, role }]);
      const me = participants.get(userId);

      return NextResponse.json(
        pusher.authorizeChannel(socketId, channel, {
          user_id: userId,
          user_info: {
            name: me?.name ?? "CeylonGuard user",
            role,
            ...(me?.imageUrl ? { imageUrl: me.imageUrl } : {}),
          },
        }),
      );
    } catch (error) {
      console.error("[chat] Could not authorise the channel", error);

      return deny(503, "The channel could not be authorised right now.");
    }
  }

  return deny(403, "Unknown channel.");
}
