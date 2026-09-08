import "server-only";

import {
  DASHBOARD_LIMITS,
  type DashboardScan,
  type FactoryDashboardData,
  type FarmerDashboardData,
  type ListingSummary,
  type OfferSummary,
  type PurchaseSummary,
  type ScanSummary,
  type SentOfferSummary,
  type SupplyListing,
  type SupplySummary,
} from "@/lib/dashboard";
import { requireFarmer, toListingItem } from "@/lib/listings.server";
import {
  requireFactory,
  resolveFarmerNames,
  toMarketListing,
} from "@/lib/marketplace.server";
import {
  buildOfferFilter,
  resolveFactoryProfiles,
  resolveOfferListings,
  toReceivedOffer,
} from "@/lib/offers.server";
import {
  ensureOrdersForAcceptedOffers,
  resolveOrderParties,
  toOrderItem,
} from "@/lib/orders.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";
import Order, { type IOrder } from "@/lib/models/Order";
import Scan, { type IScan } from "@/lib/models/Scan";

/**
 * The farmer home screen, read in one pass.
 *
 * Six reads go out together — a page of rows and a totals aggregate for each of
 * scans, listings and offers — because the screen cannot render without all of
 * them and they share one connection either way. The totals are aggregated in
 * Mongo rather than summed over the returned rows: the panels only show the
 * newest few, and a count taken from four rows would be a count of four.
 *
 * Everything is scoped by `clerkId`, so there is no id to guess and no way to
 * read another farmer's workspace.
 */

const GATE = {
  notOnboarded: "Finish setting up your account to open your workspace.",
  notFarmer: "Only farmer accounts have a farmer workspace.",
};

export type FarmerDashboardResult =
  | { ok: true; data: FarmerDashboardData }
  | { ok: false; status: number; error: string; hint?: string };

type ScanTotals = {
  _id: null;
  total: number;
  healthy: number;
  averageConfidence: number;
};

type ListingTotals = {
  _id: null;
  total: number;
  active: number;
  sold: number;
  activeWeightKg: number;
  activeValue: number;
};

type OfferTotals = {
  _id: null;
  pending: number;
  accepted: number;
  declined: number;
  bestPricePerKg: number;
  pendingValue: number;
  earnings: number;
};

/** The slice of a scan row the home screen shows. */
function toDashboardScan(scan: IScan): DashboardScan {
  return {
    id: String(scan._id),
    label: scan.label,
    isHealthy: scan.isHealthy,
    confidence: scan.confidence,
    scannedAt: new Date(scan.scannedAt).toISOString(),
  };
}

export async function getFarmerDashboard(
  clerkId: string,
): Promise<FarmerDashboardResult> {
  try {
    await connectDB();

    const access = await requireFarmer(clerkId, GATE);

    if (!access.ok) {
      return { ok: false, status: access.status, error: access.error };
    }

    const [
      scanRows,
      scanTotals,
      listingRows,
      listingTotals,
      offerRows,
      offerTotals,
    ] = await Promise.all([
      Scan.find({ clerkId })
        .sort({ scannedAt: -1 })
        .limit(DASHBOARD_LIMITS.scans)
        .select("label isHealthy confidence scannedAt")
        .lean<IScan[]>(),
      Scan.aggregate<ScanTotals>([
        { $match: { clerkId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            healthy: { $sum: { $cond: ["$isHealthy", 1, 0] } },
            averageConfidence: { $avg: "$confidence" },
          },
        },
      ]),

      Listing.find({ clerkId })
        .sort({ createdAt: -1 })
        .limit(DASHBOARD_LIMITS.listings)
        .lean<IListing[]>(),
      Listing.aggregate<ListingTotals>([
        { $match: { clerkId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            sold: {
              $sum: { $cond: [{ $eq: ["$status", "sold"] }, 1, 0] },
            },
            // Both of these read as "what is on the marketplace right now",
            // so a sold or withdrawn harvest contributes nothing to either.
            activeWeightKg: {
              $sum: {
                $cond: [{ $eq: ["$status", "active"] }, "$weightKg", 0],
              },
            },
            activeValue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "active"] },
                  { $multiply: ["$weightKg", "$pricePerKg"] },
                  0,
                ],
              },
            },
          },
        },
      ]),

      Offer.find(buildOfferFilter(clerkId, "all"))
        .sort({ createdAt: -1 })
        .limit(DASHBOARD_LIMITS.offers)
        .lean<IOffer[]>(),
      Offer.aggregate<OfferTotals>([
        { $match: { farmerClerkId: clerkId } },
        {
          $group: {
            _id: null,
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            accepted: {
              $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
            },
            declined: {
              $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] },
            },
            bestPricePerKg: {
              $max: {
                $cond: [{ $eq: ["$status", "pending"] }, "$pricePerKg", 0],
              },
            },
            pendingValue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "pending"] },
                  { $multiply: ["$pricePerKg", "$weightKg"] },
                  0,
                ],
              },
            },
            // Accepted is the only status that means money changed hands.
            earnings: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "accepted"] },
                  { $multiply: ["$pricePerKg", "$weightKg"] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    // Only the three offers on show need their mill and harvest resolved, so
    // this waits on the page above rather than joining the whole inbox.
    const [factories, listings] = await Promise.all([
      resolveFactoryProfiles(offerRows),
      resolveOfferListings(offerRows, clerkId),
    ]);

    const scanSummary = scanTotals[0];
    const listingSummary = listingTotals[0];
    const offerSummary = offerTotals[0];

    const scans: ScanSummary = {
      total: scanSummary?.total ?? 0,
      healthy: scanSummary?.healthy ?? 0,
      diseased: (scanSummary?.total ?? 0) - (scanSummary?.healthy ?? 0),
      averageConfidence: scanSummary?.averageConfidence ?? 0,
      recent: scanRows.map(toDashboardScan),
    };

    const listingStats: ListingSummary = {
      total: listingSummary?.total ?? 0,
      active: listingSummary?.active ?? 0,
      sold: listingSummary?.sold ?? 0,
      activeWeightKg: listingSummary?.activeWeightKg ?? 0,
      activeValue: listingSummary?.activeValue ?? 0,
      recent: listingRows.map(toListingItem),
    };

    const offers: OfferSummary = {
      pending: offerSummary?.pending ?? 0,
      accepted: offerSummary?.accepted ?? 0,
      declined: offerSummary?.declined ?? 0,
      bestPricePerKg: offerSummary?.bestPricePerKg ?? 0,
      pendingValue: offerSummary?.pendingValue ?? 0,
      earnings: offerSummary?.earnings ?? 0,
      recent: offerRows.map((row) =>
        toReceivedOffer(
          row,
          factories.get(row.factoryClerkId),
          listings.get(String(row.listing)),
        ),
      ),
    };

    return { ok: true, data: { scans, listings: listingStats, offers } };
  } catch (error) {
    console.error("[dashboard] Could not read the farmer workspace", error);

    return {
      ok: false,
      status: 503,
      error: "Your workspace figures could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    };
  }
}

/**
 * The factory home screen, read in one pass.
 *
 * Three questions, only two of them about this mill. What is for sale is a
 * platform-wide reading — open stock belongs to no buyer, and a mill that has
 * bought nothing yet still needs to see a market — while the offers and the
 * orders are scoped to the caller's own `clerkId`. That split is the shape of
 * the screen: the market above, this mill's position in it below.
 *
 * As on the farmer side the totals are aggregated in Mongo rather than summed
 * over the returned rows, because the panels only show the newest few and a
 * count taken from four rows would be a count of four.
 */

const FACTORY_GATE = {
  notOnboarded: "Finish setting up your account to open your workspace.",
  notFactory: "Only factory accounts have a factory workspace.",
};

/** Rupees on one row — the multiply written once and reused. */
const LISTING_VALUE = { $multiply: ["$weightKg", "$pricePerKg"] };
const TRADE_VALUE = { $multiply: ["$pricePerKg", "$weightKg"] };

/** The two states in which leaf has been bought but has not yet arrived. */
const IN_FLIGHT = { $in: ["$status", ["confirmed", "in_transit"]] };

export type FactoryDashboardResult =
  | { ok: true; data: FactoryDashboardData }
  | { ok: false; status: number; error: string; hint?: string };

type SupplyTotals = {
  _id: null;
  listings: number;
  availableKg: number;
  askingValue: number;
  districts: string[];
};

type SentOfferTotals = {
  _id: null;
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  pendingValue: number;
};

type PurchaseTotals = {
  _id: null;
  active: number;
  delivered: number;
  cancelled: number;
  committedValue: number;
  settledValue: number;
  totalKg: number;
};

type SupplierRecordRow = {
  _id: string;
  delivered: number;
  cancelled: number;
};

/** Division that answers 0 rather than NaN when nothing is on the market. */
function perKg(value: number, weight: number): number {
  return weight > 0 ? value / weight : 0;
}

export async function getFactoryDashboard(
  clerkId: string,
): Promise<FactoryDashboardResult> {
  try {
    await connectDB();

    const access = await requireFactory(clerkId, FACTORY_GATE);

    if (!access.ok) {
      return { ok: false, status: access.status, error: access.error };
    }

    // The purchase figures read the order book, so it is reconciled the way
    // the tracking screen reconciles it: a sale whose accept died halfway
    // through has no order behind it, and would be missing from the totals as
    // well as from the list. A repair that fails must not cost the mill the
    // figures it can still be shown, so it is logged and stepped over.
    try {
      await ensureOrdersForAcceptedOffers({
        clerkId,
        role: "factory",
        userId: access.factory.userId,
      });
    } catch (error) {
      console.error("[dashboard] Could not reconcile accepted offers", error);
    }

    const [supplyRows, supplyTotals, offerTotals, orderRows, purchaseTotals] =
      await Promise.all([
        // The pool the shortlist is ranked out of, freshest first.
        Listing.find({ status: "active" })
          .sort({ createdAt: -1 })
          .limit(DASHBOARD_LIMITS.supplyPool)
          .lean<IListing[]>(),
        Listing.aggregate<SupplyTotals>([
          { $match: { status: "active" } },
          {
            $group: {
              _id: null,
              listings: { $sum: 1 },
              availableKg: { $sum: "$weightKg" },
              askingValue: { $sum: LISTING_VALUE },
              districts: { $addToSet: "$district" },
            },
          },
        ]),

        Offer.aggregate<SentOfferTotals>([
          { $match: { factoryClerkId: clerkId } },
          {
            $group: {
              _id: null,
              // A bid the mill took back was sent, but it is not one of the
              // offers it currently has out, which is what this tile counts.
              total: {
                $sum: { $cond: [{ $ne: ["$status", "withdrawn"] }, 1, 0] },
              },
              pending: {
                $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
              },
              accepted: {
                $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] },
              },
              declined: {
                $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] },
              },
              pendingValue: {
                $sum: {
                  $cond: [{ $eq: ["$status", "pending"] }, TRADE_VALUE, 0],
                },
              },
            },
          },
        ]),

        // Every status, cancelled included: the badge says what happened, and
        // a consignment that fell through is recent activity worth seeing.
        Order.find({ factoryClerkId: clerkId })
          .sort({ placedAt: -1 })
          .limit(DASHBOARD_LIMITS.orders)
          .lean<IOrder[]>(),
        Order.aggregate<PurchaseTotals>([
          { $match: { factoryClerkId: clerkId } },
          {
            $group: {
              _id: null,
              active: { $sum: { $cond: [IN_FLIGHT, 1, 0] } },
              delivered: {
                $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
              },
              // Split by whether the leaf has arrived: what is still owed on
              // the road, and what has actually been taken in.
              committedValue: {
                $sum: { $cond: [IN_FLIGHT, TRADE_VALUE, 0] },
              },
              settledValue: {
                $sum: {
                  $cond: [{ $eq: ["$status", "delivered"] }, TRADE_VALUE, 0],
                },
              },
              // A cancelled order bought nothing, so it weighs nothing here.
              totalKg: {
                $sum: {
                  $cond: [{ $ne: ["$status", "cancelled"] }, "$weightKg", 0],
                },
              },
            },
          },
        ]),
      ]);

    // Only the shortlist pool and the orders on show need joining, so these
    // wait on the reads above rather than resolving the whole platform.
    const [farmers, records, parties] = await Promise.all([
      resolveFarmerNames(supplyRows),
      Order.aggregate<SupplierRecordRow>([
        {
          $match: {
            farmerClerkId: { $in: supplyRows.map((row) => row.clerkId) },
          },
        },
        {
          $group: {
            _id: "$farmerClerkId",
            delivered: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
          },
        },
        // A seller whose every consignment is still moving has concluded
        // nothing, so they have no record yet rather than a record of zero.
        {
          $match: {
            $expr: { $gt: [{ $add: ["$delivered", "$cancelled"] }, 0] },
          },
        },
      ]),
      resolveOrderParties(orderRows),
    ]);

    const byFarmer = new Map(records.map((row) => [row._id, row]));

    const shortlist: SupplyListing[] = supplyRows
      .map((row) => {
        const record = byFarmer.get(row.clerkId);

        return {
          ...toMarketListing(row, farmers.get(row.clerkId)),
          ...(record
            ? {
                record: {
                  delivered: record.delivered,
                  cancelled: record.cancelled,
                  reliability:
                    (record.delivered / (record.delivered + record.cancelled)) *
                    100,
                },
              }
            : {}),
        };
      })
      // Best-regarded first, with completed deliveries breaking ties so one
      // flawless trade does not outrank fifty. A seller with no record yet is
      // ranked as neither good nor bad: below one that has earned a good
      // record, above one that has earned a poor one, rather than buried.
      .sort((a, b) => {
        const left = a.record?.reliability ?? 50;
        const right = b.record?.reliability ?? 50;

        if (right !== left) return right - left;

        const leftDone = a.record?.delivered ?? 0;
        const rightDone = b.record?.delivered ?? 0;

        if (rightDone !== leftDone) return rightDone - leftDone;

        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, DASHBOARD_LIMITS.supply);

    const stock = supplyTotals[0];
    const sent = offerTotals[0];
    const bought = purchaseTotals[0];

    const availableKg = stock?.availableKg ?? 0;
    const askingValue = stock?.askingValue ?? 0;

    const supply: SupplySummary = {
      listings: stock?.listings ?? 0,
      availableKg,
      askingValue,
      avgPricePerKg: perKg(askingValue, availableKg),
      districts: stock?.districts.filter(Boolean).length ?? 0,
      recent: shortlist,
    };

    const offers: SentOfferSummary = {
      total: sent?.total ?? 0,
      pending: sent?.pending ?? 0,
      accepted: sent?.accepted ?? 0,
      declined: sent?.declined ?? 0,
      pendingValue: sent?.pendingValue ?? 0,
    };

    const purchases: PurchaseSummary = {
      active: bought?.active ?? 0,
      delivered: bought?.delivered ?? 0,
      cancelled: bought?.cancelled ?? 0,
      committedValue: bought?.committedValue ?? 0,
      settledValue: bought?.settledValue ?? 0,
      totalKg: bought?.totalKg ?? 0,
      recent: orderRows.map((row) => toOrderItem(row, "factory", parties)),
    };

    return { ok: true, data: { supply, offers, purchases } };
  } catch (error) {
    console.error("[dashboard] Could not read the factory workspace", error);

    return {
      ok: false,
      status: 503,
      error: "Your workspace figures could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    };
  }
}
