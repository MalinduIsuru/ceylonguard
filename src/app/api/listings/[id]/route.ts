import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import {
  toDayString,
  validateListingInput,
  type DeleteListingSuccess,
  type ListingFailure,
  type ListingStatus,
  type UpdateListingInput,
  type UpdateListingSuccess,
} from "@/lib/listings";
import { requireFarmer, toListingItem } from "@/lib/listings.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer from "@/lib/models/Offer";

/**
 * One of the farmer's own listings.
 *
 * PATCH edits the harvest details, moves the listing between active, sold and
 * withdrawn, or both in one request; DELETE removes it for good. Both scope
 * the query by `clerkId` as well as `_id`, so a guessed id from another
 * farmer's account reads as "not found" rather than acting on it.
 *
 * Both also close any offer still standing on a harvest that has stopped
 * trading, so the farmer's inbox never shows a bid that can no longer be
 * accepted and the mill that sent it stops waiting on an answer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ListingStatus[] = ["active", "sold", "withdrawn"];

/** The harvest details a farmer may correct after publishing. */
const EDITABLE = [
  "weightKg",
  "pricePerKg",
  "district",
  "harvestDate",
] as const;

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

  let payload: UpdateListingInput;

  try {
    payload = (await request.json()) as UpdateListingInput;
  } catch {
    return fail(400, { ok: false, error: "The request could not be read." });
  }

  const { status } = payload;

  if (
    status !== undefined &&
    (typeof status !== "string" || !STATUSES.includes(status as ListingStatus))
  ) {
    return fail(422, {
      ok: false,
      error: "A listing can only be set to active, sold or withdrawn.",
    });
  }

  // An edit is any harvest field the client bothered to send; the rest are
  // filled in from the stored row below, so a one-field correction is enough.
  const edited = EDITABLE.some((field) => payload[field] !== undefined);

  if (status === undefined && !edited) {
    return fail(422, {
      ok: false,
      error: "There was nothing to change on this listing.",
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

    if (edited) {
      const currentHarvestDate = toDayString(new Date(listing.harvestDate));

      const validated = validateListingInput(
        {
          weightKg: payload.weightKg ?? listing.weightKg,
          pricePerKg: payload.pricePerKg ?? listing.pricePerKg,
          district: payload.district ?? listing.district,
          harvestDate: payload.harvestDate ?? currentHarvestDate,
        },
        { currentHarvestDate },
      );

      if (!validated.ok) {
        return fail(422, {
          ok: false,
          error: "Some details need fixing before this listing can be saved.",
          fieldErrors: validated.errors,
        });
      }

      listing.weightKg = validated.value.weightKg;
      listing.pricePerKg = validated.value.pricePerKg;
      listing.district = validated.value.district;
      listing.harvestDate = validated.value.harvestDay;
    }

    if (status !== undefined) {
      listing.status = status as ListingStatus;
    }

    await listing.save();

    // Accepting an offer closes the rivals itself; this is the same tidy-up
    // for the farmer taking the harvest off the market by hand.
    if (status === "sold" || status === "withdrawn") {
      await Offer.updateMany(
        { listing: listing._id, status: "pending" },
        { $set: { status: "declined" } },
      );
    }

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

    // The offers outlive the listing they were sent on — they are the record
    // of a trade — but none of them is still answerable.
    await Offer.updateMany(
      { listing: deleted._id, status: "pending" },
      { $set: { status: "declined" } },
    );

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
