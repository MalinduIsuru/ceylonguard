import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireFarmer } from "@/lib/listings.server";
import {
  OFFERS_MAX_PAGE_SIZE,
  OFFERS_PAGE_SIZE,
  type OfferFailure,
  type OfferStats,
  type OffersSuccess,
} from "@/lib/offers";
import {
  buildOfferFilter,
  readOfferFilter,
  resolveFactoryProfiles,
  resolveOfferListings,
  toReceivedOffer,
} from "@/lib/offers.server";
import connectDB from "@/lib/mongodb";
import Offer, { type IOffer } from "@/lib/models/Offer";

/**
 * The offers a farmer has received on their harvests.
 *
 * The mirror image of `/api/marketplace`: the same rows, read by the seller.
 * Rows come back with the totals above them, because the page needs both to
 * render and they come from one connection rather than two round trips. The
 * totals are counted over every offer rather than the filtered slice, so
 * narrowing the inbox does not make the pending count move.
 *
 * Reads are scoped by `farmerClerkId`, which the offer carries denormalised
 * off the listing — one indexed read, no join, and no way to page through
 * another farmer's inbox.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATE = {
  notOnboarded: "Finish setting up your account before reviewing offers.",
  notFarmer: "Only farmer accounts receive offers on harvest listings.",
};

function fail(status: number, body: OfferFailure) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to view your offers.",
    });
  }

  const params = new URL(request.url).searchParams;
  const filter = readOfferFilter(params);

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), OFFERS_MAX_PAGE_SIZE)
      : OFFERS_PAGE_SIZE;

  try {
    await connectDB();

    const access = await requireFarmer(userId, GATE);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const [rows, totals] = await Promise.all([
      Offer.find(buildOfferFilter(userId, filter))
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<IOffer[]>(),
      Offer.aggregate<{
        _id: null;
        pending: number;
        accepted: number;
        declined: number;
        bestPricePerKg: number;
        pendingValue: number;
      }>([
        { $match: { farmerClerkId: userId } },
        {
          $group: {
            _id: null,
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            accepted: {
              $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
            },
            declined: {
              $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] },
            },
            // Both of these read as "what is still on the table", so a
            // decided or withdrawn offer contributes nothing to either.
            bestPricePerKg: {
              $max: {
                $cond: [{ $eq: ["$status", "pending"] }, "$pricePerKg", 0],
              },
            },
            pendingValue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "pending"] },
                  { $multiply: ["$pricePerKg", "$weightKg"] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const [factories, listings] = await Promise.all([
      resolveFactoryProfiles(rows),
      resolveOfferListings(rows, userId),
    ]);

    const summary = totals[0];

    const stats: OfferStats = {
      pending: summary?.pending ?? 0,
      accepted: summary?.accepted ?? 0,
      declined: summary?.declined ?? 0,
      bestPricePerKg: summary?.bestPricePerKg ?? 0,
      pendingValue: summary?.pendingValue ?? 0,
    };

    const body: OffersSuccess = {
      ok: true,
      items: rows.map((row) =>
        toReceivedOffer(
          row,
          factories.get(row.factoryClerkId),
          listings.get(String(row.listing)),
        ),
      ),
      stats,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[offers] Could not read the inbox", error);

    return fail(503, {
      ok: false,
      error: "Your offers could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
