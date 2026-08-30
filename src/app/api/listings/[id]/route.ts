import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import type {
  DeleteListingSuccess,
  ListingFailure,
  ListingStatus,
  UpdateListingSuccess,
} from "@/lib/listings";
import { requireFarmer, toListingItem } from "@/lib/listings.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";

/**
 * One of the farmer's own listings.
 *
 * PATCH moves it between active, sold and withdrawn; DELETE removes it for
 * good. Both scope the query by `clerkId` as well as `_id`, so a guessed id
 * from another farmer's account reads as "not found" rather than acting on it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ListingStatus[] = ["active", "sold", "withdrawn"];

function fail(status: number, body: ListingFailure) {
  return NextResponse.json(body, { status });
}

const NOT_FOUND: ListingFailure = {
  ok: false,
  error: "That listing no longer exists.",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to change a listing.",
    });
  }

  const { id } = await params;

  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  let payload: { status?: unknown };

  try {
    payload = (await request.json()) as { status?: unknown };
  } catch {
    return fail(400, { ok: false, error: "The request could not be read." });
  }

  const status = payload.status;

  if (typeof status !== "string" || !STATUSES.includes(status as ListingStatus)) {
    return fail(422, {
      ok: false,
      error: "A listing can only be set to active, sold or withdrawn.",
    });
  }

  try {
    await connectDB();

    const access = await requireFarmer(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const listing = await Listing.findOne({ _id: id, clerkId: userId });

    if (!listing) return fail(404, NOT_FOUND);

    listing.status = status as ListingStatus;

    // Withdrawing hands the stamp back, so re-opening a listing has to check
    // that its scan was not spent on another harvest in the meantime.
    if (status === "active" && listing.scan) {
      const taken = await Listing.exists({
        _id: { $ne: listing._id },
        clerkId: userId,
        scan: listing.scan,
        status: { $ne: "withdrawn" },
      });

      if (taken) {
        listing.scan = undefined;
        listing.verification = undefined;
      }
    }

    await listing.save();

    const body: UpdateListingSuccess = {
      ok: true,
      listing: toListingItem(listing.toObject() as IListing),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[listings] Could not update the listing", error);

    return fail(503, {
      ok: false,
      error: "The listing could not be updated right now.",
    });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to remove a listing.",
    });
  }

  const { id } = await params;

  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  try {
    await connectDB();

    const access = await requireFarmer(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const deleted = await Listing.findOneAndDelete({
      _id: id,
      clerkId: userId,
    }).lean<IListing | null>();

    if (!deleted) return fail(404, NOT_FOUND);

    const body: DeleteListingSuccess = { ok: true, id };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[listings] Could not delete the listing", error);

    return fail(503, {
      ok: false,
      error: "The listing could not be removed right now.",
    });
  }
}
