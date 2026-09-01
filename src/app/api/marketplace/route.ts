import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  MARKET_LIMITS,
  type MarketplaceFailure,
  type MarketplaceSuccess,
} from "@/lib/marketplace";
import {
  buildListingFilter,
  readMarketQuery,
  requireFactory,
  resolveFarmerNames,
  toMarketListing,
  toMarketOffer,
} from "@/lib/marketplace.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";

/**
 * The harvest discovery feed: every farmer's open listing, seen from a mill.
 *
 * The filters run in Mongo rather than in the page, so the feed stays correct
 * once there is more stock than one response can carry. The districts behind
 * the filter and the mill's own standing offers come back with the rows — the
 * page needs all three to render, and they come from one connection rather
 * than three round trips.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: MarketplaceFailure) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to browse the marketplace.",
    });
  }

  const params = new URL(request.url).searchParams;
  const query = readMarketQuery(params);

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MARKET_LIMITS.maxPageSize)
      : MARKET_LIMITS.pageSize;

  try {
    await connectDB();

    const access = await requireFactory(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const filter = await buildListingFilter(query);

    const [rows, districts, offers] = await Promise.all([
      Listing.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<IListing[]>(),
      Listing.distinct("district", { status: "active" }) as Promise<string[]>,
      // Every standing offer, not just those on the filtered rows: narrowing
      // the feed should not make an offer this mill already sent disappear.
      Offer.find({ factoryClerkId: userId, status: { $ne: "withdrawn" } })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean<IOffer[]>(),
    ]);

    const farmers = await resolveFarmerNames(rows);

    const body: MarketplaceSuccess = {
      ok: true,
      items: rows.map((row) => toMarketListing(row, farmers.get(row.clerkId))),
      districts: districts.filter(Boolean).sort((a, b) => a.localeCompare(b)),
      offers: offers.map(toMarketOffer),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[marketplace] Could not read the feed", error);

    return fail(503, {
      ok: false,
      error: "The marketplace could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
