import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import { requireFarmer } from "@/lib/listings.server";
import {
  isOfferDecision,
  RECEIVED_STATUS_META,
  type DecideOfferSuccess,
  type OfferFailure,
} from "@/lib/offers";
import { hydrateOffer } from "@/lib/offers.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";

/**
 * The seller's decision on one offer.
 *
 * Accepting is the only write in the app that touches three rows at once: the
 * offer is accepted, its harvest is marked sold, and every rival bid on that
 * harvest is declined. There is no transaction here — the deployment target is
 * a single Atlas connection shared by serverless invocations, and the rest of
 * the app writes the same way — so the listing is claimed first with a
 * conditional update. That flip from `active` to `sold` is the one point where
 * two accepts can race, and only one of them can win it; the loser is told the
 * harvest is already sold rather than quietly double-selling it.
 *
 * Everything is scoped by `farmerClerkId` as well as `_id`, so a guessed id
 * from another farmer's inbox reads as "not found" rather than acting on it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATE = {
  notOnboarded: "Finish setting up your account before answering offers.",
  notFarmer: "Only farmer accounts can answer offers on harvest listings.",
};

function fail(status: number, body: OfferFailure) {
  return NextResponse.json(body, { status });
}

const NOT_FOUND: OfferFailure = {
  ok: false,
  error: "That offer no longer exists.",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to answer an offer.",
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

  const decision = payload.status;

  if (!isOfferDecision(decision)) {
    return fail(422, {
      ok: false,
      error: "An offer can only be accepted or declined.",
    });
  }

  try {
    await connectDB();

    const access = await requireFarmer(userId, GATE);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const offer = await Offer.findOne({
      _id: id,
      farmerClerkId: userId,
    }).lean<IOffer | null>();

    if (!offer) return fail(404, NOT_FOUND);

    if (offer.status !== "pending") {
      return fail(409, {
        ok: false,
        error: "That offer has already been answered.",
        hint: `It currently reads: ${RECEIVED_STATUS_META[offer.status].label}.`,
      });
    }

    if (decision === "declined") {
      const declined = await Offer.findOneAndUpdate(
        { _id: offer._id, farmerClerkId: userId, status: "pending" },
        { $set: { status: "declined" } },
        { new: true },
      ).lean<IOffer | null>();

      if (!declined) {
        return fail(409, {
          ok: false,
          error: "That offer has already been answered.",
        });
      }

      const body: DecideOfferSuccess = {
        ok: true,
        offer: await hydrateOffer(declined, userId),
        listingSold: false,
        declined: 0,
      };

      return NextResponse.json(body);
    }

    // Claim the harvest first: whoever flips it out of `active` owns the sale.
    const sold = await Listing.findOneAndUpdate(
      { _id: offer.listing, clerkId: userId, status: "active" },
      { $set: { status: "sold" } },
      { new: true },
    ).lean<IListing | null>();

    if (!sold) {
      const listing = await Listing.findOne({
        _id: offer.listing,
        clerkId: userId,
      })
        .select("status")
        .lean<{ status: string } | null>();

      if (!listing) {
        return fail(409, {
          ok: false,
          error: "The harvest behind this offer no longer exists.",
          hint: "Decline the offer to clear it from your inbox.",
        });
      }

      return fail(409, {
        ok: false,
        error:
          listing.status === "sold"
            ? "That harvest has already been sold to another offer."
            : "That harvest has been withdrawn from the marketplace.",
        hint: "Re-list the harvest if you still want to sell it.",
      });
    }

    const accepted = await Offer.findOneAndUpdate(
      { _id: offer._id, farmerClerkId: userId, status: "pending" },
      { $set: { status: "accepted" } },
      { new: true },
    ).lean<IOffer | null>();

    if (!accepted) {
      // The mill withdrew between the two writes, so the sale never happened:
      // put the harvest back on the marketplace rather than leaving it sold
      // against an offer that is no longer standing.
      await Listing.updateOne(
        { _id: sold._id, clerkId: userId, status: "sold" },
        { $set: { status: "active" } },
      );

      return fail(409, {
        ok: false,
        error: "That offer was withdrawn before you could accept it.",
      });
    }

    // Losing bids are closed rather than left pending: the harvest is gone, so
    // the mills that bid on it should see that immediately.
    const rivals = await Offer.updateMany(
      { listing: offer.listing, _id: { $ne: offer._id }, status: "pending" },
      { $set: { status: "declined" } },
    );

    const body: DecideOfferSuccess = {
      ok: true,
      offer: await hydrateOffer(accepted, userId),
      listingSold: true,
      declined: rivals.modifiedCount ?? 0,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[offers] Could not answer the offer", error);

    return fail(503, {
      ok: false,
      error: "The offer could not be answered right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
