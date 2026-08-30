import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  LISTINGS_PAGE_SIZE,
  validateListingInput,
  type CreateListingInput,
  type CreateListingSuccess,
  type ListingFailure,
  type ListingStats,
  type ListingsSuccess,
} from "@/lib/listings";
import {
  requireFarmer,
  resolveAvailableStamp,
  toListingItem,
} from "@/lib/listings.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";

/**
 * The farmer's own harvest listings.
 *
 * GET returns the rows, the totals shown above them, and the AI Disease Free
 * Stamp that is still available to spend — the page needs all three to render,
 * and they come from one connection rather than three round trips.
 *
 * POST publishes a listing. The stamp is resolved server-side from the
 * farmer's own recent healthy scans: the client sends a yes/no, never a scan
 * id, so a listing cannot be stamped with a scan that is not the farmer's or
 * one that has already been spent.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: ListingFailure) {
  return NextResponse.json(body, { status });
}

const DB_DOWN: ListingFailure = {
  ok: false,
  error: "Your listings could not be loaded right now.",
  hint: "Check that the database connection in .env.local is reachable.",
};

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to view your listings.",
    });
  }

  const params = new URL(request.url).searchParams;
  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 100)
      : LISTINGS_PAGE_SIZE;

  try {
    await connectDB();

    const access = await requireFarmer(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const [rows, totals, available] = await Promise.all([
      Listing.find({ clerkId: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<IListing[]>(),
      Listing.aggregate<{
        _id: null;
        active: number;
        verified: number;
        totalWeightKg: number;
        averagePricePerKg: number;
      }>([
        { $match: { clerkId: userId, status: "active" } },
        {
          $group: {
            _id: null,
            active: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $ifNull: ["$verification", false] }, 1, 0] },
            },
            totalWeightKg: { $sum: "$weightKg" },
            averagePricePerKg: { $avg: "$pricePerKg" },
          },
        },
      ]),
      resolveAvailableStamp(userId),
    ]);

    const summary = totals[0];

    const stats: ListingStats = {
      active: summary?.active ?? 0,
      verified: summary?.verified ?? 0,
      totalWeightKg: summary?.totalWeightKg ?? 0,
      averagePricePerKg: summary?.averagePricePerKg ?? 0,
    };

    const body: ListingsSuccess = {
      ok: true,
      items: rows.map(toListingItem),
      stats,
      stamp: available?.stamp ?? null,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[listings] Could not read listings", error);

    return fail(503, DB_DOWN);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to publish a listing.",
    });
  }

  let payload: CreateListingInput;

  try {
    payload = (await request.json()) as CreateListingInput;
  } catch {
    return fail(400, { ok: false, error: "The listing form could not be read." });
  }

  const validated = validateListingInput(payload);

  if (!validated.ok) {
    return fail(422, {
      ok: false,
      error: "Some details need fixing before this listing can be published.",
      fieldErrors: validated.errors,
    });
  }

  const { weightKg, pricePerKg, district, harvestDay } = validated.value;

  try {
    await connectDB();

    const access = await requireFarmer(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    // Only ask for the stamp when the farmer wants it; an unstamped listing is
    // a normal outcome, not a fallback.
    const available = payload.useStamp ? await resolveAvailableStamp(userId) : null;

    const listing = new Listing({
      clerkId: userId,
      user: access.farmer.userId,

      weightKg,
      pricePerKg,
      district,
      harvestDate: harvestDay,

      status: "active",

      ...(available
        ? {
            scan: available.scan._id,
            verification: {
              label: available.scan.label,
              confidence: available.scan.confidence,
              scannedAt: available.scan.scannedAt,
              ...(available.scan.imageUrl
                ? { imageUrl: available.scan.imageUrl }
                : {}),
            },
          }
        : {}),
    });

    await listing.save();

    const body: CreateListingSuccess = {
      ok: true,
      listing: toListingItem(listing.toObject<IListing>()),
      verified: available !== null,
    };

    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    console.error("[listings] Could not publish the listing", error);

    return fail(503, {
      ok: false,
      error: "The listing could not be published right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
