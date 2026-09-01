import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { totalUnreadFor } from "@/lib/chat.server";
import connectDB from "@/lib/mongodb";

/**
 * Unread messages across every thread.
 *
 * Its own route because the sidebar badge is on every dashboard page and needs
 * one number, not the inbox behind it. Signed-out or unreachable both answer
 * zero: a badge is not worth an error banner in the navigation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();

  if (!userId) return NextResponse.json({ ok: true, total: 0 });

  try {
    await connectDB();

    return NextResponse.json({ ok: true, total: await totalUnreadFor(userId) });
  } catch (error) {
    console.error("[chat] Could not count unread messages", error);

    return NextResponse.json({ ok: true, total: 0 });
  }
}
