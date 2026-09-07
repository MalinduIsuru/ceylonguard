import "server-only";

import type { QueryFilter, Types } from "mongoose";

import { toDayString } from "@/lib/listings";
import type { MarketListing, MarketOffer } from "@/lib/marketplace";
import type { IListing } from "@/lib/models/Listing";
import type { IOffer } from "@/lib/models/Offer";
import User from "@/lib/models/User";

/** Server-side pieces of the marketplace, kept out of the client bundle. */

/** Shown when a farmer published before filling in their profile name. */
const ANONYMOUS_FARMER = "CeylonGuard farmer";

export type FactoryContext = {
  clerkId: string;
  /** Mongo `_id` of the matching user row, absent if they never onboarded. */
  userId?: Types.ObjectId;
  factoryName?: string;
};

/**
 * Resolves the signed-in factory, or the reason it cannot use the marketplace.
 *
 * Mirrors `requireFarmer`: the role is read from the database rather than the
 * Clerk session, so a stale token cannot let a farmer account bid on stock.
 */
export async function requireFactory(
  clerkId: string,
): Promise<
  | { ok: true; factory: FactoryContext }
  | { ok: false; status: number; error: string }
> {
  const user = await User.findOne({ clerkId })
    .select("_id role factoryName")
    .lean<{
      _id: Types.ObjectId;
      role?: string;
      factoryName?: string;
    } | null>();

  if (!user) {
    return {
      ok: false,
      status: 403,
      error: "Finish setting up your account before browsing the marketplace.",
    };
  }

  if (user.role !== "factory") {
    return {
      ok: false,
      status: 403,
      error: "Only factory accounts can browse listings and send offers.",
    };
  }

  return {
    ok: true,
    factory: {
      clerkId,
      userId: user._id,
      ...(user.factoryName ? { factoryName: user.factoryName } : {}),
    },
  };
}

/** Escapes user text before it is used inside a Mongo regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The filters the browse page can apply, read off the request URL.
 *
 * Anything unparseable is dropped rather than rejected: a half-typed number in
 * a filter box should show the unfiltered feed, not an error.
 */
export type MarketQuery = {
  search: string;
  district: string;
  maxPrice: number | null;
  minQty: number | null;
};

export function readMarketQuery(params: URLSearchParams): MarketQuery {
  const readPositive = (raw: string | null): number | null => {
    const parsed = Number(raw);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    search: (params.get("q") ?? "").trim().slice(0, 64),
    district: (params.get("district") ?? "").trim().slice(0, 64),
    maxPrice: readPositive(params.get("maxPrice")),
    minQty: readPositive(params.get("minQty")),
  };
}

/**
 * Turns the filters into a Mongo filter over open stock.
 *
 * The free-text box searches seller names as well as districts, and a name
 * lives on `User` rather than `Listing`, so matching sellers are resolved to
 * their `clerkId`s first and folded in beside the district match.
 */
export async function buildListingFilter(
  query: MarketQuery,
): Promise<QueryFilter<IListing>> {
  const filter: QueryFilter<IListing> = { status: "active" };

  if (query.district) filter.district = query.district;

  if (query.maxPrice !== null) filter.pricePerKg = { $lte: query.maxPrice };

  if (query.minQty !== null) filter.weightKg = { $gte: query.minQty };

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");

    const sellers = await User.find({
      role: "farmer",
      $or: [{ firstName: pattern }, { lastName: pattern }],
    })
      .select("clerkId")
      .limit(100)
      .lean<{ clerkId: string }[]>();

    filter.$or = [
      { district: pattern },
      ...(sellers.length > 0
        ? [{ clerkId: { $in: sellers.map((seller) => seller.clerkId) } }]
        : []),
    ];
  }

  return filter;
}

/**
 * Names the sellers behind a page of listings.
 *
 * Looked up by `clerkId` rather than through the `user` ref, so rows written
 * before that ref existed still show a seller name.
 */
export async function resolveFarmerNames(
  listings: IListing[],
): Promise<Map<string, { name: string; district?: string }>> {
  const clerkIds = [...new Set(listings.map((listing) => listing.clerkId))];

  if (clerkIds.length === 0) return new Map();

  const users = await User.find({ clerkId: { $in: clerkIds } })
    .select("clerkId firstName lastName district")
    .lean<
      {
        clerkId: string;
        firstName?: string;
        lastName?: string;
        district?: string;
      }[]
    >();

  return new Map(
    users.map((user) => [
      user.clerkId,
      {
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          ANONYMOUS_FARMER,
        ...(user.district ? { district: user.district } : {}),
      },
    ]),
  );
}

/** Mongo row to the shape the browse feed renders. */
export function toMarketListing(
  listing: IListing,
  farmer?: { name: string; district?: string },
): MarketListing {
  return {
    id: String(listing._id),
    farmer: farmer?.name ?? ANONYMOUS_FARMER,
    ...(farmer?.district ? { farmerDistrict: farmer.district } : {}),

    weightKg: listing.weightKg,
    pricePerKg: listing.pricePerKg,
    totalValue: listing.weightKg * listing.pricePerKg,
    district: listing.district,
    harvestDate: toDayString(new Date(listing.harvestDate)),

    createdAt: new Date(listing.createdAt).toISOString(),
  };
}

export function toMarketOffer(offer: IOffer): MarketOffer {
  return {
    id: String(offer._id),
    listingId: String(offer.listing),
    pricePerKg: offer.pricePerKg,
    status: offer.status,
    createdAt: new Date(offer.createdAt).toISOString(),
  };
}
