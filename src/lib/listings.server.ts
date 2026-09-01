import "server-only";

import type { Types } from "mongoose";

import {
  STAMP_VALID_DAYS,
  toDayString,
  type AvailableStamp,
  type ListingItem,
} from "@/lib/listings";
import Listing, { type IListing } from "@/lib/models/Listing";
import Scan, { type IScan } from "@/lib/models/Scan";
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
    ...(listing.verification
      ? {
          verification: {
            label: listing.verification.label,
            confidence: listing.verification.confidence,
            scannedAt: new Date(listing.verification.scannedAt).toISOString(),
            ...(listing.verification.imageUrl
              ? { imageUrl: listing.verification.imageUrl }
              : {}),
          },
        }
      : {}),
    createdAt: new Date(listing.createdAt).toISOString(),
  };
}

/**
 * The healthy scan this farmer may still spend on a listing, or null.
 *
 * A scan counts when it is recent enough to say something about the leaf being
 * sold now, and is not already carrying an open listing. Withdrawing a listing
 * hands its scan back, which is why withdrawn rows are skipped here.
 */
export async function resolveAvailableStamp(
  clerkId: string,
): Promise<{ scan: IScan; stamp: AvailableStamp } | null> {
  const cutoff = new Date(Date.now() - STAMP_VALID_DAYS * 86_400_000);

  const spent = (await Listing.distinct("scan", {
    clerkId,
    scan: { $exists: true },
    status: { $ne: "withdrawn" },
  })) as Types.ObjectId[];

  const scan = await Scan.findOne({
    clerkId,
    isHealthy: true,
    scannedAt: { $gte: cutoff },
    ...(spent.length > 0 ? { _id: { $nin: spent } } : {}),
  })
    .sort({ scannedAt: -1 })
    .lean<IScan | null>();

  if (!scan) return null;

  return {
    scan,
    stamp: {
      scanId: String(scan._id),
      label: scan.label,
      confidence: scan.confidence,
      scannedAt: new Date(scan.scannedAt).toISOString(),
      ...(scan.imageUrl ? { imageUrl: scan.imageUrl } : {}),
    },
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
