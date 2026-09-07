import "server-only";

import {
  DASHBOARD_LIMITS,
  type DashboardScan,
  type FarmerDashboardData,
  type ListingSummary,
  type OfferSummary,
  type ScanSummary,
} from "@/lib/dashboard";
import { requireFarmer, toListingItem } from "@/lib/listings.server";
import {
  buildOfferFilter,
  resolveFactoryProfiles,
  resolveOfferListings,
  toReceivedOffer,
} from "@/lib/offers.server";
import connectDB from "@/lib/mongodb";
import Listing, { type IListing } from "@/lib/models/Listing";
import Offer, { type IOffer } from "@/lib/models/Offer";
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
