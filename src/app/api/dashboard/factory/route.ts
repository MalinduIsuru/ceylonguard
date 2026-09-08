import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import type {
  FactoryDashboardFailure,
  FactoryDashboardSuccess,
} from "@/lib/dashboard";
import { getFactoryDashboard } from "@/lib/dashboard.server";

/**
 * The factory home screen as JSON.
 *
 * Mirrors `/api/dashboard/farmer`: the page itself renders from
 * `getFactoryDashboard` directly — it is a server component, so a fetch back
 * into the same process would only add a round trip — and this route is the
 * same reading over HTTP, for anything that has to refresh the figures after a
 * write without a full navigation.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: FactoryDashboardFailure) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to view your workspace.",
    });
  }

  const result = await getFactoryDashboard(userId);

  if (!result.ok) {
    return fail(result.status, {
      ok: false,
      error: result.error,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  }

  const body: FactoryDashboardSuccess = { ok: true, data: result.data };

  return NextResponse.json(body);
}
