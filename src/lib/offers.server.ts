import "server-only";

import type { QueryFilter } from "mongoose";

import { toDayString } from "@/lib/listings";
import {
  isOfferFilter,
  type OfferFilter,
  type OfferListing,
  type ReceivedOffer,
} from "@/lib/offers";
import type { IListing } from "@/lib/models/Listing";
import type { IOffer } from "@/lib/models/Offer";
import Listing from "@/lib/models/Listing";
import User from "@/lib/models/User";

/** Server-side pieces of the offers inbox, kept out of the client bundle. */

/** Shown when a mill bid before filling in its profile. */
const ANONYMOUS_FACTORY = "Tea factory";

export type FactoryProfile = {
  name: string;
  district?: string;
  phone?: string;
};

/**
 * The filter to read off the request URL.
 *
 * "all" deliberately excludes withdrawn offers: a bid the mill has pulled is
 * not a decision the farmer still has to make, so it stays out of the inbox
 * unless it is asked for by name.
 */
export function readOfferFilter(params: URLSearchParams): OfferFilter {
  const raw = params.get("status");

  return isOfferFilter(raw) ? raw : "all";
}

export function buildOfferFilter(
  farmerClerkId: string,
  filter: OfferFilter,
): QueryFilter<IOffer> {
  return {
    farmerClerkId,
    ...(filter === "all"
      ? { status: { $ne: "withdrawn" } }
      : { status: filter }),
  };
}

/**
 * Names the mills behind a page of offers.
 *
 * The live profile wins over the `factoryName` frozen on the offer so a mill
 * that has since completed its onboarding stops reading as anonymous; the
 * frozen copy is what is left when the account row has gone.
 */
export async function resolveFactoryProfiles(
  offers: IOffer[],
): Promise<Map<string, FactoryProfile>> {
  const clerkIds = [...new Set(offers.map((offer) => offer.factoryClerkId))];

  if (clerkIds.length === 0) return new Map();

  const users = await User.find({ clerkId: { $in: clerkIds } })
    .select("clerkId firstName lastName factoryName district phone")
    .lean<
      {
        clerkId: string;
        firstName?: string;
        lastName?: string;
        factoryName?: string;
        district?: string;
        phone?: string;
      }[]
    >();

  return new Map(
    users.map((user) => [
      user.clerkId,
      {
        name:
          user.factoryName?.trim() ||
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          ANONYMOUS_FACTORY,
        ...(user.district ? { district: user.district } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
      },
    ]),
  );
}

/**
 * The harvests a page of offers is against, as they stand today.
 *
 * Scoped by `clerkId` as well as the ids, so an offer row pointing at someone
 * else's listing — which should not exist — cannot surface it here.
 */
export async function resolveOfferListings(
  offers: IOffer[],
  farmerClerkId: string,
): Promise<Map<string, OfferListing>> {
  const ids = [...new Set(offers.map((offer) => String(offer.listing)))];

  if (ids.length === 0) return new Map();

  const listings = await Listing.find({
    _id: { $in: ids },
    clerkId: farmerClerkId,
  })
    .select("district harvestDate status")
    .lean<IListing[]>();

  return new Map(
    listings.map((listing) => [
      String(listing._id),
      {
        id: String(listing._id),
        district: listing.district,
        harvestDate: toDayString(new Date(listing.harvestDate)),
        status: listing.status,
      },
    ]),
  );
}

/** Mongo row to the shape the offers inbox renders. */
export function toReceivedOffer(
  offer: IOffer,
  factory?: FactoryProfile,
  listing?: OfferListing,
): ReceivedOffer {
  return {
    id: String(offer._id),
    // `||` rather than `??`: a profile saved as whitespace should fall
    // through to the next name, not read as a mill called "".
    factory: factory?.name || offer.factoryName?.trim() || ANONYMOUS_FACTORY,
    ...(factory?.district ? { factoryDistrict: factory.district } : {}),
    ...(factory?.phone ? { factoryPhone: factory.phone } : {}),

    pricePerKg: offer.pricePerKg,
    askingPricePerKg: offer.askingPricePerKg,
    weightKg: offer.weightKg,
    totalValue: offer.pricePerKg * offer.weightKg,

    ...(offer.message ? { message: offer.message } : {}),
    status: offer.status,

    createdAt: new Date(offer.createdAt).toISOString(),
    updatedAt: new Date(offer.updatedAt).toISOString(),

    ...(listing ? { listing } : {}),
  };
}

/** One offer, with its mill and harvest resolved. Used after a decision. */
export async function hydrateOffer(
  offer: IOffer,
  farmerClerkId: string,
): Promise<ReceivedOffer> {
  const [factories, listings] = await Promise.all([
    resolveFactoryProfiles([offer]),
    resolveOfferListings([offer], farmerClerkId),
  ]);

  return toReceivedOffer(
    offer,
    factories.get(offer.factoryClerkId),
    listings.get(String(offer.listing)),
  );
}
