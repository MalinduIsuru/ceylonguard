import type { ListingItem } from "@/lib/listings";
import type { MarketListing } from "@/lib/marketplace";
import type { ReceivedOffer } from "@/lib/offers";
import type { OrderItem } from "@/lib/orders";

/**
 * Shared contract between /api/dashboard/* and the two home screens.
 *
 * Each home screen is a reading of features that already have their own APIs —
 * scans, listings and offers for the farmer; the marketplace, sent offers and
 * orders for the factory — so the rows here reuse those contracts
 * (`ListingItem`, `ReceivedOffer`, `MarketListing`, `OrderItem`) rather than
 * inventing thinner copies. What is new is the summary beside them: the counts
 * and rupee totals either side would otherwise have to open three pages to add
 * up.
 */

/** One row in "Recent scans" — the slice of a scan the dashboard shows. */
export type DashboardScan = {
  id: string;
  /** Human-facing disease name, e.g. "Healthy" or "Grey Blight". */
  label: string;
  isHealthy: boolean;
  /** Percentage, 0 to 100. */
  confidence: number;
  /** ISO 8601. */
  scannedAt: string;
};

export type ScanSummary = {
  total: number;
  healthy: number;
  diseased: number;
  /** Mean confidence across every scan, 0 when there are none. */
  averageConfidence: number;
  /** Newest first. */
  recent: DashboardScan[];
};

export type ListingSummary = {
  total: number;
  active: number;
  sold: number;
  /** Kilograms sitting on the marketplace right now. */
  activeWeightKg: number;
  /** What that open stock is worth at the farmer's own asking prices. */
  activeValue: number;
  /** Newest first. */
  recent: ListingItem[];
};

export type OfferSummary = {
  pending: number;
  accepted: number;
  declined: number;
  /** Highest price among pending offers, 0 when none are pending. */
  bestPricePerKg: number;
  /** Rupees across every pending offer — what is still on the table. */
  pendingValue: number;
  /** Rupees across every accepted offer — what the harvests have earned. */
  earnings: number;
  /** Newest first, excluding bids the mill has pulled. */
  recent: ReceivedOffer[];
};

export type FarmerDashboardData = {
  scans: ScanSummary;
  listings: ListingSummary;
  offers: OfferSummary;
};

export type FarmerDashboardSuccess = {
  ok: true;
  data: FarmerDashboardData;
};

export type FarmerDashboardFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type FarmerDashboardResponse =
  | FarmerDashboardSuccess
  | FarmerDashboardFailure;

/**
 * A seller's track record, counted across every mill they have traded with.
 *
 * Deliberately not scoped to the factory reading it: a supplier this mill has
 * never bought from is exactly the one its buyer needs a second opinion on,
 * and a record that only counted our own purchases would be empty for every
 * new name on the feed. Only outcomes are shared — never who the counterparty
 * was, or what they paid.
 */
export type SupplierRecord = {
  /** Consignments that arrived. */
  delivered: number;
  /** Consignments that fell through after the offer was accepted. */
  cancelled: number;
  /**
   * Delivered as a percentage of trades that actually concluded, 0 to 100.
   *
   * Consignments still moving are in neither half: they are not yet a success
   * or a failure, and counting them as either would make a mill that buys
   * heavily this week look unreliable until the lorries arrive.
   */
  reliability: number;
};

/** A market listing plus the seller's standing, which the feed joins in. */
export type SupplyListing = MarketListing & {
  /** Absent until this seller has concluded a trade with anybody. */
  record?: SupplierRecord;
};

/** What is on the marketplace right now, across every farmer. */
export type SupplySummary = {
  /** Active listings, platform-wide. */
  listings: number;
  /** Kilograms of open stock. */
  availableKg: number;
  /** What that stock is worth at the farmers' own asking prices. */
  askingValue: number;
  /**
   * Rupees per kilogram across open stock.
   *
   * Weighted — asking value over weight — so a 20 kg lot at an outlier price
   * cannot move it the way a 750 kg lot does.
   */
  avgPricePerKg: number;
  /** Districts with stock on the market. */
  districts: number;
  /** The shortlist, best-regarded sellers first. */
  recent: SupplyListing[];
};

/** The bids this factory has out. */
export type SentOfferSummary = {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
  /** Rupees across pending offers — what this mill has on the table. */
  pendingValue: number;
};

/** The consignments this factory has bought. */
export type PurchaseSummary = {
  /** Confirmed plus in transit: bought, not yet arrived. */
  active: number;
  delivered: number;
  cancelled: number;
  /** Rupees owed on leaf that has not arrived yet. */
  committedValue: number;
  /** Rupees on leaf that has been weighed in. */
  settledValue: number;
  /** Kilograms bought, cancelled consignments excluded. */
  totalKg: number;
  /** Newest first. */
  recent: OrderItem[];
};

export type FactoryDashboardData = {
  supply: SupplySummary;
  offers: SentOfferSummary;
  purchases: PurchaseSummary;
};

export type FactoryDashboardSuccess = {
  ok: true;
  data: FactoryDashboardData;
};

export type FactoryDashboardFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type FactoryDashboardResponse =
  | FactoryDashboardSuccess
  | FactoryDashboardFailure;

/** How many rows each panel on the home screens shows. */
export const DASHBOARD_LIMITS = {
  scans: 4,
  listings: 4,
  offers: 3,
  /** Listings on the factory's shortlist. */
  supply: 4,
  /**
   * Freshest listings the shortlist is chosen from.
   *
   * Ranking every open listing by its seller's record would mean resolving a
   * record for every farmer on the platform to fill four rows. Green leaf has
   * to be processed within a day or so of picking, so the freshest stock is
   * the stock worth ranking at all — this takes that pool and sorts it.
   */
  supplyPool: 20,
  /** Rows in the factory's "Recent orders". */
  orders: 4,
} as const;

/**
 * What the page renders when the figures cannot be read.
 *
 * A dashboard that cannot reach the database still draws — as an empty one
 * with a notice — rather than replacing the whole workspace with an error.
 */
export const EMPTY_FARMER_DASHBOARD: FarmerDashboardData = {
  scans: {
    total: 0,
    healthy: 0,
    diseased: 0,
    averageConfidence: 0,
    recent: [],
  },
  listings: {
    total: 0,
    active: 0,
    sold: 0,
    activeWeightKg: 0,
    activeValue: 0,
    recent: [],
  },
  offers: {
    pending: 0,
    accepted: 0,
    declined: 0,
    bestPricePerKg: 0,
    pendingValue: 0,
    earnings: 0,
    recent: [],
  },
};

/** The same for the factory: a home screen that draws even when Mongo is out. */
export const EMPTY_FACTORY_DASHBOARD: FactoryDashboardData = {
  supply: {
    listings: 0,
    availableKg: 0,
    askingValue: 0,
    avgPricePerKg: 0,
    districts: 0,
    recent: [],
  },
  offers: {
    total: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
    pendingValue: 0,
  },
  purchases: {
    active: 0,
    delivered: 0,
    cancelled: 0,
    committedValue: 0,
    settledValue: 0,
    totalKg: 0,
    recent: [],
  },
};

/** "Today", "Yesterday" or "N days ago" for an ISO timestamp. */
export function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";

  return `${days} days ago`;
}

/** "460 kg" — weights are shown in whole kilograms. */
export function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString("en-LK")} kg`;
}
