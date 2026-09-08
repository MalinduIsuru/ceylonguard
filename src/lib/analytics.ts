import type { OrderStatus } from "@/lib/orders";

/**
 * Shared contract between /api/analytics and the procurement analytics screen.
 *
 * Analytics is a reading of the order book rather than a store of its own: an
 * order is the only row that says a factory actually bought something at a
 * price, so every figure here is derived from `Order` scoped to the mill that
 * is asking. Nothing is written.
 *
 * A cancelled consignment bought no leaf, so it is excluded from every weight,
 * rupee and average below. It is still counted — `summary.cancelled` and the
 * per-supplier reliability figure are the whole reason it is worth keeping —
 * but it never moves a total, which is what stops "total spend" from drifting
 * above what the mill will actually pay.
 */

export type { OrderStatus };

/** How far back a reading looks. */
export type AnalyticsRange = "30d" | "90d" | "1y" | "all";

/**
 * How the trend is bucketed.
 *
 * Tied to the range rather than chosen separately: a month is one bar over a
 * 30-day window, and a day is 365 bars over a year, so neither reads as a
 * trend. The bucket is picked to land somewhere near a dozen points.
 */
export type TrendGranularity = "day" | "week" | "month";

export const ANALYTICS_RANGES: AnalyticsRange[] = ["30d", "90d", "1y", "all"];

export const ANALYTICS_RANGE_META: Record<
  AnalyticsRange,
  { label: string; days: number | null; granularity: TrendGranularity }
> = {
  "30d": { label: "30 days", days: 30, granularity: "day" },
  "90d": { label: "90 days", days: 90, granularity: "week" },
  "1y": { label: "12 months", days: 365, granularity: "month" },
  all: { label: "All time", days: null, granularity: "month" },
};

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = "90d";

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return (
    typeof value === "string" &&
    ANALYTICS_RANGES.includes(value as AnalyticsRange)
  );
}

/** Range to a query string; the default window asks for the plain reading. */
export function analyticsQueryString(range: AnalyticsRange): string {
  return range === DEFAULT_ANALYTICS_RANGE ? "" : `?range=${range}`;
}

/** The headline figures, over non-cancelled orders in the window. */
export type ProcurementSummary = {
  /** Consignments that were not cancelled. */
  orders: number;
  cancelled: number;
  /** Kilograms bought. */
  totalKg: number;
  /** Rupees across every live consignment, delivered or not. */
  totalSpend: number;
  /** Rupees on leaf that has arrived and been weighed in. */
  settledSpend: number;
  /** Rupees owed on leaf still confirmed or on the road. */
  committedSpend: number;
  /**
   * Rupees per kilogram across the window.
   *
   * Weighted — spend over weight, not the mean of the per-order prices — so a
   * 20 kg lot at an outlier price cannot move it the way a 750 kg lot does.
   */
  avgPricePerKg: number;
  /** Distinct farmers bought from. */
  suppliers: number;
  /** Distinct districts supplied from. */
  districts: number;
};

/** Where the order book stands right now, across the window. */
export type StatusMix = {
  confirmed: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
};

/** One bucket on the trend. */
export type TrendPoint = {
  /** ISO 8601 — UTC start of the bucket, which is also its identity. */
  start: string;
  orders: number;
  kg: number;
  spend: number;
};

export type DistrictBreakdown = {
  district: string;
  orders: number;
  kg: number;
  spend: number;
  avgPricePerKg: number;
  /** This district's share of the window's kilograms, 0 to 100. */
  shareOfKg: number;
};

export type SupplierBreakdown = {
  clerkId: string;
  name: string;
  district?: string;
  orders: number;
  kg: number;
  spend: number;
  avgPricePerKg: number;
  /** Consignments this farmer cancelled inside the window. */
  cancelled: number;
  /**
   * Delivered as a percentage of everything they agreed to, 0 to 100.
   *
   * Cancellations are in the denominator, which is the point: this is how
   * often leaf that was promised actually arrived.
   */
  reliability: number;
};

/**
 * Movement against the window immediately before this one.
 *
 * Each figure is a percentage change, and null when the earlier window bought
 * nothing — there is no honest percentage against a base of zero, and showing
 * "+100%" for a mill's first month would be worse than showing nothing.
 */
export type PeriodComparison = {
  /** ISO 8601 — start of the window being compared against. */
  from: string;
  totalSpend: number | null;
  totalKg: number | null;
  orders: number | null;
  avgPricePerKg: number | null;
};

export type ProcurementAnalytics = {
  range: AnalyticsRange;
  granularity: TrendGranularity;
  /** ISO 8601 — start of the window; null when the range is "all". */
  from: string | null;
  /** ISO 8601 — when the reading was taken. */
  to: string;

  summary: ProcurementSummary;
  statusMix: StatusMix;
  /** Null for "all time", which has nothing before it to compare against. */
  previous: PeriodComparison | null;

  /** Oldest first, with empty buckets filled in so the axis is even. */
  trend: TrendPoint[];
  /** Heaviest first. */
  districts: DistrictBreakdown[];
  /** Biggest spend first, capped at `ANALYTICS_LIMITS.suppliers`. */
  suppliers: SupplierBreakdown[];
};

export type AnalyticsSuccess = {
  ok: true;
  data: ProcurementAnalytics;
};

export type AnalyticsFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type AnalyticsResponse = AnalyticsSuccess | AnalyticsFailure;

export const ANALYTICS_LIMITS = {
  /** Rows in "Top suppliers". */
  suppliers: 6,
  /** Rows in "Top supplier districts". */
  districts: 8,
  /** Buckets on the trend, whatever the granularity. */
  trendPoints: 30,
} as const;

/** What the stat tiles read while the first request is still in flight. */
export const EMPTY_SUMMARY: ProcurementSummary = {
  orders: 0,
  cancelled: 0,
  totalKg: 0,
  totalSpend: 0,
  settledSpend: 0,
  committedSpend: 0,
  avgPricePerKg: 0,
  suppliers: 0,
  districts: 0,
};

/** Percentage change from `before` to `after`; null when there is no base. */
export function percentChange(before: number, after: number): number | null {
  if (before <= 0) return null;

  return ((after - before) / before) * 100;
}

/** "+12%" / "-8%" — the sign is the whole message, so it is always shown. */
export function formatChange(value: number): string {
  const rounded = Math.round(value);

  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** "1,240 kg" — leaf is weighed in whole kilograms. */
export function formatKilos(value: number): string {
  return `${Math.round(value).toLocaleString("en-LK")} kg`;
}

/** The label a trend bucket wears, given how the trend was bucketed. */
export function formatTrendLabel(
  start: string,
  granularity: TrendGranularity,
): string {
  const date = new Date(start);

  if (Number.isNaN(date.getTime())) return "—";

  // UTC throughout: the buckets were cut in UTC on the server, so reading them
  // back in the browser's own zone would slide a label onto the wrong day.
  if (granularity === "month") {
    return date.toLocaleDateString("en-LK", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }

  return date.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** The span a bucket covers, for the tooltip that has room to spell it out. */
export function formatTrendSpan(
  start: string,
  granularity: TrendGranularity,
): string {
  const label = formatTrendLabel(start, granularity);

  if (granularity === "week") return `Week of ${label}`;
  if (granularity === "month") return label;

  return label;
}
