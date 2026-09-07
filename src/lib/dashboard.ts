import type { ListingItem } from "@/lib/listings";
import type { ReceivedOffer } from "@/lib/offers";

/**
 * Shared contract between /api/dashboard/farmer and the farmer's home screen.
 *
 * The home screen is a reading of three features that already have their own
 * APIs — scans, listings, offers — so the rows here reuse those contracts
 * (`ListingItem`, `ReceivedOffer`) rather than inventing thinner copies. What
 * is new is the summary beside them: the counts and rupee totals the farmer
 * would otherwise have to open three pages to add up.
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

/** How many rows each panel on the home screen shows. */
export const DASHBOARD_LIMITS = {
  scans: 4,
  listings: 4,
  offers: 3,
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
