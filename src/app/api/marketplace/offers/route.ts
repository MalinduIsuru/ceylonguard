import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import {
  MARKET_LIMITS,
  validateOfferPrice,
  type CreateOfferInput,
  type CreateOfferSuccess,
  type MarketplaceFailure,
  type WithdrawOfferSuccess,
} from "@/lib/marketplace";
import { requireFactory, toMarketOffer } from "@/lib/marketplace.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";

/**
 * Offers a factory sends on harvest listings.
 *
 * POST is an upsert keyed by (listing, factory): a mill has one standing offer
 * per harvest, so re-submitting the form moves its price rather than stacking
 * a second bid beside it. The farmer and the advertised price and weight are
 * copied off the listing here — the client sends only the id and the price, so
 * a buyer cannot claim to be bidding on terms the farmer never published.
 *
 * DELETE withdraws the offer, which is a status change rather than a removal:
 * the farmer may already have seen it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: MarketplaceFailure) {
  return NextResponse.json(body, { status });
}

const GONE: MarketplaceFailure = {
  ok: false,
  error: "That listing is no longer on the marketplace.",
};

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to send an offer.",
    });
  }

  let payload: CreateOfferInput;

  try {
    payload = (await request.json()) as CreateOfferInput;
  } catch {
    return fail(400, { ok: false, error: "The offer could not be read." });
  }

  const listingId = typeof payload.listingId === "string" ? payload.listingId : "";

  if (!isValidObjectId(listingId)) return fail(404, GONE);

  const price = validateOfferPrice(payload.pricePerKg);

  if (!price.ok) return fail(422, { ok: false, error: price.error });

  const message =
    typeof payload.message === "string"
      ? payload.message.trim().slice(0, MARKET_LIMITS.maxMessageLength)
      : "";

  try {
    await connectDB();

    const access = await requireFactory(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const listing = await Listing.findById(listingId).lean<IListing | null>();

    if (!listing) return fail(404, GONE);

    if (listing.status !== "active") {
      return fail(409, {
        ok: false,
        error: "That harvest is no longer taking offers.",
        hint: "The farmer has marked it sold or withdrawn it.",
      });
    }

    if (listing.clerkId === userId) {
      return fail(403, {
        ok: false,
        error: "You cannot send an offer on your own listing.",
      });
    }

    const existing = await Offer.findOne({
      listing: listing._id,
      factoryClerkId: userId,
    });

    const offer =
      existing ??
      new Offer({
        listing: listing._id,
        farmerClerkId: listing.clerkId,
        factoryClerkId: userId,
        factoryUser: access.factory.userId,
      });

    // Re-offering re-opens a bid the farmer declined, and re-prices the terms
    // against the listing as it stands today rather than as first advertised.
    offer.pricePerKg = price.value;
    offer.askingPricePerKg = listing.pricePerKg;
    offer.weightKg = listing.weightKg;
    offer.status = "pending";

    if (access.factory.factoryName) offer.factoryName = access.factory.factoryName;

    if (message) offer.message = message;

    await offer.save();

    const body: CreateOfferSuccess = {
      ok: true,
      offer: toMarketOffer(offer.toObject() as IOffer),
      created: existing === null,
    };

    return NextResponse.json(body, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[marketplace] Could not send the offer", error);

    return fail(503, {
      ok: false,
      error: "The offer could not be sent right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to withdraw an offer.",
    });
  }

  const listingId = new URL(request.url).searchParams.get("listingId") ?? "";

  if (!isValidObjectId(listingId)) return fail(404, GONE);

  try {
    await connectDB();

    const access = await requireFactory(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    // Scoped by `factoryClerkId` as well as the listing, so a guessed id from
    // another mill reads as "not found" rather than acting on its offer.
    const offer = await Offer.findOneAndUpdate(
      { listing: listingId, factoryClerkId: userId },
      { $set: { status: "withdrawn" } },
      { new: true },
    ).lean<IOffer | null>();

    if (!offer) {
      return fail(404, { ok: false, error: "That offer no longer exists." });
    }

    const body: WithdrawOfferSuccess = {
      ok: true,
      offer: toMarketOffer(offer),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[marketplace] Could not withdraw the offer", error);

    return fail(503, {
      ok: false,
      error: "The offer could not be withdrawn right now.",
    });
  }
}
