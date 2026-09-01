import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  CHAT_EVENTS,
  threadChannel,
  type ChatFailure,
  type TypingEvent,
} from "@/lib/chat";
import { resolveParticipants, requireThread } from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";
import { broadcast } from "@/lib/pusher.server";

/**
 * Announces that someone is typing in a thread.
 *
 * Nothing is written down — a typing flag is only true for the next few
 * seconds, and the receiving side drops it on a timer of its own if the
 * composer goes quiet without saying so. The sender's own connection is
 * excluded from the broadcast, so a composer never sees itself typing.
 *
 * The name on the event comes from the database rather than from the request,
 * for the same reason the presence payload does.
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

  if (!userId) return fail(401, { ok: false, error: "You need to be signed in." });

  const { id } = await params;

  let payload: { typing?: unknown; socketId?: unknown };

  try {
    payload = (await request.json()) as { typing?: unknown; socketId?: unknown };
  } catch {
    payload = {};
  }

  const typing = payload.typing !== false;
  const socketId =
    typeof payload.socketId === "string" ? payload.socketId : undefined;

  try {
    await connectDB();

    const access = await requireThread(id, userId);

    if (!access.ok) return fail(access.status, { ok: false, error: access.error });

    const participants = await resolveParticipants([
      { clerkId: userId, role: access.role },
    ]);

    const event: TypingEvent = {
      clerkId: userId,
      name: participants.get(userId)?.name ?? "They",
      typing,
    };

    await broadcast(
      threadChannel(String(access.conversation._id)),
      CHAT_EVENTS.typing,
      event,
      socketId,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[chat] Could not send the typing signal", error);

    // A dropped typing ping is not worth an error on screen.
    return NextResponse.json({ ok: true });
  }
}
