import "server-only";

import type { QueryFilter, Types } from "mongoose";

import { toDayString } from "@/lib/listings";
import {
  isOrderFilter,
  orderReference,
  type OrderFilter,
  type OrderItem,
  type OrderParty,
  type OrderRole,
} from "@/lib/orders";
import type { IListing } from "@/lib/models/Listing";
import Listing from "@/lib/models/Listing";
import type { IOffer } from "@/lib/models/Offer";
import Offer from "@/lib/models/Offer";
import Order, { type IOrder } from "@/lib/models/Order";
import User from "@/lib/models/User";

/** Server-side pieces of order tracking, kept out of the client bundle. */

/** Shown when one side traded before filling in its profile. */
const ANONYMOUS_FARMER = "CeylonGuard farmer";
const ANONYMOUS_FACTORY = "Tea factory";

/** Written when the harvest behind a reconciled order has been deleted. */
const UNKNOWN_DISTRICT = "District not recorded";

/**
 * How far back a read will reconcile. Large enough that no real account hits
 * it, small enough that the reconciliation stays one bounded pair of reads.
 */
const BACKFILL_LIMIT = 200;

export type TradeAccount = {
  clerkId: string;
  role: OrderRole;
  userId?: Types.ObjectId;
};

/**
 * Resolves the signed-in account and which side of the trade it is on.
 *
 * Orders are the one screen both roles read, so this does not gate on a role
 * the way `requireFarmer` and `requireFactory` do — it reports the role, and
 * the transition rules in `@/lib/orders` decide what that side may do. As
 * there, the role comes from the database rather than the Clerk session, so a
 * stale token cannot move an order the account is not a party to.
 */
export async function requireTradeAccount(
  clerkId: string,
): Promise<
  | { ok: true; account: TradeAccount }
  | { ok: false; status: number; error: string }
> {
  const user = await User.findOne({ clerkId })
    .select("_id role")
    .lean<{ _id: Types.ObjectId; role?: string } | null>();

  if (!user) {
    return {
      ok: false,
      status: 403,
      error: "Finish setting up your account before tracking orders.",
    };
  }

  if (user.role !== "farmer" && user.role !== "factory") {
    return {
      ok: false,
      status: 403,
      error: "Only farmer and factory accounts take part in orders.",
    };
  }

  return {
    ok: true,
    account: { clerkId, role: user.role, userId: user._id },
  };
}

/**
 * The filter to read off the request URL.
 *
 * "all" deliberately excludes cancelled orders, mirroring the offers inbox: a
 * sale that fell through is not a consignment anyone is still tracking, so it
 * stays out of the list unless it is asked for by name.
 */
export function readOrderFilter(params: URLSearchParams): OrderFilter {
  const raw = params.get("status");

  return isOrderFilter(raw) ? raw : "all";
}

/** Scopes every read to the caller's own side of the trade. */
export function buildOrderFilter(
  account: TradeAccount,
  filter: OrderFilter,
): QueryFilter<IOrder> {
  return {
    ...(account.role === "factory"
      ? { factoryClerkId: account.clerkId }
      : { farmerClerkId: account.clerkId }),
    ...(filter === "all"
      ? { status: { $ne: "cancelled" } }
      : { status: filter }),
  };
}

/**
 * Names both sides of a page of orders in one read.
 *
 * The live profile wins over the name frozen on the order so a mill that has
 * since completed its onboarding stops reading as anonymous; the frozen copy
 * is what is left when the account row has gone.
 */
export async function resolveOrderParties(
  orders: IOrder[],
): Promise<Map<string, OrderParty>> {
  const clerkIds = [
    ...new Set(
      orders.flatMap((order) => [order.farmerClerkId, order.factoryClerkId]),
    ),
  ];

  if (clerkIds.length === 0) return new Map();

  const users = await User.find({ clerkId: { $in: clerkIds } })
    .select("clerkId firstName lastName factoryName role district phone")
    .lean<
      {
        clerkId: string;
        firstName?: string;
        lastName?: string;
        factoryName?: string;
        role?: string;
        district?: string;
        phone?: string;
      }[]
    >();

  return new Map(
    users.map((user) => {
      const person = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      // A mill trades under its mill name; everyone else under their own.
      // `||` rather than `??`: a profile saved as whitespace should fall
      // through to the next name, not read as a mill called "".
      const name =
        user.role === "factory" ? user.factoryName?.trim() || person : person;

      return [
        user.clerkId,
        {
          name:
            name ||
            (user.role === "factory" ? ANONYMOUS_FACTORY : ANONYMOUS_FARMER),
          ...(user.district ? { district: user.district } : {}),
          ...(user.phone ? { phone: user.phone } : {}),
        },
      ];
    }),
  );
}

/** Mongo row to the shape the tracking screen renders. */
export function toOrderItem(
  order: IOrder,
  viewerRole: OrderRole,
  parties: Map<string, OrderParty>,
): OrderItem {
  const id = String(order._id);

  const farmer = parties.get(order.farmerClerkId);
  const factory = parties.get(order.factoryClerkId);

  return {
    id,
    reference: orderReference(id),
    offerId: String(order.offer),
    listingId: String(order.listing),

    farmer: {
      ...farmer,
      name: farmer?.name || order.farmerName?.trim() || ANONYMOUS_FARMER,
    },
    factory: {
      ...factory,
      name: factory?.name || order.factoryName?.trim() || ANONYMOUS_FACTORY,
    },
    viewerRole,

    district: order.district,
    harvestDate: toDayString(new Date(order.harvestDate)),

    weightKg: order.weightKg,
    pricePerKg: order.pricePerKg,
    totalValue: order.weightKg * order.pricePerKg,

    status: order.status,
    placedAt: new Date(order.placedAt).toISOString(),
    updatedAt: new Date(order.updatedAt).toISOString(),
    timeline: order.timeline.map((event) => ({
      status: event.status,
      at: new Date(event.at).toISOString(),
      byClerkId: event.byClerkId,
      byRole:
        event.byClerkId === order.farmerClerkId
          ? ("farmer" as const)
          : ("factory" as const),
    })),

    ...(order.cancelledReason ? { cancelledReason: order.cancelledReason } : {}),
  };
}

/** One order with both sides resolved. Used after a status change. */
export async function hydrateOrder(
  order: IOrder,
  viewerRole: OrderRole,
): Promise<OrderItem> {
  return toOrderItem(order, viewerRole, await resolveOrderParties([order]));
}

/** The row an accepted offer becomes, ready to insert. */
type OrderDraft = Omit<IOrder, "_id" | "createdAt" | "updatedAt">;

function draftOrder(
  offer: IOffer,
  listing: Pick<IListing, "district" | "harvestDate"> | null,
  names: { farmer?: string; factory?: string },
): OrderDraft {
  // The acceptance is the order's own clock: the row can be written long
  // after it, and a reconciled order should still be dated by the sale.
  const placedAt = new Date(offer.updatedAt);

  const factoryName = names.factory ?? offer.factoryName;

  return {
    offer: offer._id,
    listing: offer.listing,

    farmerClerkId: offer.farmerClerkId,
    factoryClerkId: offer.factoryClerkId,

    ...(names.farmer ? { farmerName: names.farmer } : {}),
    ...(factoryName ? { factoryName } : {}),

    district: listing?.district ?? UNKNOWN_DISTRICT,
    harvestDate: listing ? new Date(listing.harvestDate) : placedAt,

    weightKg: offer.weightKg,
    pricePerKg: offer.pricePerKg,

    status: "confirmed",
    placedAt,
    // The farmer struck the deal by accepting, so the opening event is theirs.
    timeline: [
      { status: "confirmed", at: placedAt, byClerkId: offer.farmerClerkId },
    ],
  };
}

/** Display names for both sides of a set of offers, in one read. */
async function resolveTradeNames(
  offers: IOffer[],
): Promise<Map<string, string>> {
  const clerkIds = [
    ...new Set(
      offers.flatMap((offer) => [offer.farmerClerkId, offer.factoryClerkId]),
    ),
  ];

  if (clerkIds.length === 0) return new Map();

  const users = await User.find({ clerkId: { $in: clerkIds } })
    .select("clerkId firstName lastName factoryName role")
    .lean<
      {
        clerkId: string;
        firstName?: string;
        lastName?: string;
        factoryName?: string;
        role?: string;
      }[]
    >();

  const names = new Map<string, string>();

  for (const user of users) {
    const person = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const name =
      user.role === "factory" ? user.factoryName?.trim() || person : person;

    if (name) names.set(user.clerkId, name);
  }

  return names;
}

/**
 * Turns one accepted offer into an order.
 *
 * Called from the accept, where the offer has just flipped and the harvest has
 * just been marked sold. `offer` is unique on the collection, so a retried or
 * doubled accept lands on the existing row rather than a second consignment —
 * the duplicate key is caught and the standing order read back.
 */
export async function createOrderForOffer(
  offer: IOffer,
  listing: Pick<IListing, "district" | "harvestDate"> | null,
): Promise<IOrder | null> {
  const names = await resolveTradeNames([offer]);

  const draft = draftOrder(offer, listing, {
    farmer: names.get(offer.farmerClerkId),
    factory: names.get(offer.factoryClerkId),
  });

  try {
    const created = await Order.create(draft);

    return created.toObject() as IOrder;
  } catch (error) {
    // The unique index on `offer` is what makes this idempotent: an accept
    // retried, or racing the reconciliation below, loses the insert and reads
    // the standing row instead, which is the same order either way.
    if ((error as { code?: number }).code === 11000) {
      return Order.findOne({ offer: offer._id }).lean<IOrder | null>();
    }

    throw error;
  }
}

/**
 * Writes the orders that accepted offers on this side of the trade are missing.
 *
 * Two things need this. Offers accepted before order tracking existed have no
 * order behind them, and would otherwise never appear on the screen at all.
 * And because the accept writes the offer and the order separately, a request
 * that died between the two leaves a sale with no consignment — reconciling on
 * read means that heals itself the next time either side opens the page,
 * rather than needing somebody to notice.
 *
 * Returns how many rows were written, which is almost always zero.
 */
export async function ensureOrdersForAcceptedOffers(
  account: TradeAccount,
): Promise<number> {
  const accepted = await Offer.find({
    ...(account.role === "factory"
      ? { factoryClerkId: account.clerkId }
      : { farmerClerkId: account.clerkId }),
    status: "accepted",
  })
    .sort({ updatedAt: -1 })
    .limit(BACKFILL_LIMIT)
    .lean<IOffer[]>();

  if (accepted.length === 0) return 0;

  const existing = await Order.find({
    offer: { $in: accepted.map((offer) => offer._id) },
  })
    .select("offer")
    .lean<{ offer: Types.ObjectId }[]>();

  const covered = new Set(existing.map((order) => String(order.offer)));
  const missing = accepted.filter((offer) => !covered.has(String(offer._id)));

  if (missing.length === 0) return 0;

  const [listings, names] = await Promise.all([
    Listing.find({ _id: { $in: missing.map((offer) => offer.listing) } })
      .select("district harvestDate")
      .lean<
        (Pick<IListing, "district" | "harvestDate"> & {
          _id: Types.ObjectId;
        })[]
      >(),
    resolveTradeNames(missing),
  ]);

  const byId = new Map(listings.map((row) => [String(row._id), row]));

  const drafts = missing.map((offer) =>
    draftOrder(offer, byId.get(String(offer.listing)) ?? null, {
      farmer: names.get(offer.farmerClerkId),
      factory: names.get(offer.factoryClerkId),
    }),
  );

  try {
    // Unordered, so one row losing the unique key to a concurrent reader does
    // not stop the rest of the batch being written.
    const written = await Order.insertMany(drafts, { ordered: false });

    return written.length;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return (error as { insertedDocs?: unknown[] }).insertedDocs?.length ?? 0;
    }

    throw error;
  }
}
