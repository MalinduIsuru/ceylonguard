import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  DEFAULT_ANALYTICS_RANGE,
  isAnalyticsRange,
  type AnalyticsFailure,
  type AnalyticsSuccess,
} from "@/lib/analytics";
import { getProcurementAnalytics } from "@/lib/analytics.server";

/**
 * What the signed-in factory has bought, summarised.
 *
 * Read-only and factory-only. A farmer's side of the same orders is a
 * different question with different totals — what they earned, not what it
 * cost — so it is not served by widening this route's scope; the gate in
 * `getProcurementAnalytics` turns them away rather than showing them a
 * purchase ledger written from the wrong side.
 *
 * `range` is the only input. Anything unrecognised falls back to the default
 * window rather than erroring: a mistyped query string should show the mill
 * its figures, not a failure.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: AnalyticsFailure) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to view procurement analytics.",
    });
  }

  const raw = new URL(request.url).searchParams.get("range");
  const range = isAnalyticsRange(raw) ? raw : DEFAULT_ANALYTICS_RANGE;

  const result = await getProcurementAnalytics(userId, range);

  if (!result.ok) {
    return fail(result.status, {
      ok: false,
      error: result.error,
      ...(result.hint ? { hint: result.hint } : {}),
    });
  }

  const body: AnalyticsSuccess = { ok: true, data: result.data };

  return NextResponse.json(body);
}
