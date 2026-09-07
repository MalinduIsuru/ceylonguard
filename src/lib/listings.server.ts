import "server-only";

import type { Types } from "mongoose";

import { toDayString, type ListingItem } from "@/lib/listings";
import { type IListing } from "@/lib/models/Listing";
import User from "@/lib/models/User";

/** Server-side pieces of the listings feature, kept out of the client bundle. */

/** Mongo row to the shape the marketplace UI renders. */
export function toListingItem(listing: IListing): ListingItem {
  return {
    id: String(listing._id),
    weightKg: listing.weightKg,
    pricePerKg: listing.pricePerKg,
    totalValue: listing.weightKg * listing.pricePerKg,
    district: listing.district,
    harvestDate: toDayString(new Date(listing.harvestDate)),
    status: listing.status,
    createdAt: new Date(listing.createdAt).toISOString(),
  };
}

export type FarmerContext = {
  clerkId: string;
  /** Mongo `_id` of the matching user row, absent if they never onboarded. */
  userId?: Types.ObjectId;
};

/**
 * Wording for the two ways the gate can close, so callers that are not the
 * publish form can say what the visitor was actually trying to do.
 */
export type FarmerGateMessages = {
  notOnboarded?: string;
  notFarmer?: string;
};

/**
 * Resolves the signed-in farmer, or the reason they cannot act as one.
 *
 * The role is read from the database rather than the Clerk session so a stale
 * token cannot let a factory account publish harvests or answer offers.
 */
export async function requireFarmer(
  clerkId: string,
  messages: FarmerGateMessages = {},
): Promise<
  { ok: true; farmer: FarmerContext } | { ok: false; status: number; error: string }
> {
  const user = await User.findOne({ clerkId })
    .select("_id role")
    .lean<{ _id: Types.ObjectId; role?: string } | null>();

  if (!user) {
    return {
      ok: false,
      status: 403,
      error:
        messages.notOnboarded ??
        "Finish setting up your account before posting a listing.",
    };
  }

  if (user.role !== "farmer") {
    return {
      ok: false,
      status: 403,
      error: messages.notFarmer ?? "Only farmer accounts can post harvest listings.",
    };
  }

  return { ok: true, farmer: { clerkId, userId: user._id } };
}
