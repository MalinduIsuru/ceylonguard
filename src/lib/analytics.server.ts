import "server-only";

import {
  ANALYTICS_LIMITS,
  ANALYTICS_RANGE_META,
  percentChange,
  type AnalyticsRange,
  type DistrictBreakdown,
  type PeriodComparison,
  type ProcurementAnalytics,
  type ProcurementSummary,
  type StatusMix,
  type SupplierBreakdown,
  type TrendGranularity,
  type TrendPoint,
} from "@/lib/analytics";
import { requireFactory } from "@/lib/marketplace.server";
import {
  ensureOrdersForAcceptedOffers,
  resolveTradeParties,
} from "@/lib/orders.server";
import connectDB from "@/lib/mongodb";
import Order from "@/lib/models/Order";

/**
 * Procurement analytics, read in one pass over the mill's own order book.
 *
 * Everything is one `$facet` because the summary, the district split, the
 * supplier league table and the trend are four readings of the same set of
 * rows — running them as four pipelines would scan the same orders four
 * times, and the screen cannot draw without all of them anyway. The one read
 * that sits outside it is the previous window, which by definition matches
 * different documents.
 *
 * The figures are aggregated in Mongo rather than summed in the page. That is
 * not only about speed: the page would otherwise need every order it is
 * summarising in its hands, and a mill with three seasons of purchases behind
 * it would be shipping its whole order book to the browser to draw four tiles.
 *
 * Scoped by `factoryClerkId` throughout, so there is no id to guess and no way
 * to read another mill's buying.
 */

/** Rupees on one order — the multiply written once and reused. */
const ORDER_VALUE = { $multiply: ["$pricePerKg", "$weightKg"] };

/** True for an order that actually bought leaf. */
const IS_LIVE = { $ne: ["$status", "cancelled"] };

const IS_DELIVERED = { $eq: ["$status", "delivered"] };
const IS_CANCELLED = { $eq: ["$status", "cancelled"] };

/** Rows a cancelled consignment must not appear in. */
const LIVE_ONLY = { $match: { status: { $ne: "cancelled" } } };

/**
 * A ceiling on the fill loop below.
 *
 * The loop is bounded by the window anyway, but "all time" takes its start
 * from the data, and a single order with a mistyped harvest date decades back
 * should not turn into a million iterations before the slice throws them away.
 */
const MAX_TREND_BUCKETS = 400;

const GATE = {
  notOnboarded: "Finish setting up your account to see your buying figures.",
  notFactory: "Only factory accounts have procurement analytics.",
};

export type ProcurementAnalyticsResult =
  | { ok: true; data: ProcurementAnalytics }
  | { ok: false; status: number; error: string; hint?: string };

type SummaryRow = {
  _id: null;
  orders: number;
  confirmed: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
  totalKg: number;
  totalSpend: number;
  settledSpend: number;
  committedSpend: number;
};

type DistrictRow = {
  _id: string;
  orders: number;
  kg: number;
  spend: number;
};

type SupplierRow = {
  _id: string;
  name?: string;
  orders: number;
  delivered: number;
  cancelled: number;
  kg: number;
  spend: number;
};

type TrendRow = {
  _id: Date;
  orders: number;
  kg: number;
  spend: number;
};

type CountRow = { value: number };

type AnalyticsFacet = {
  summary: SummaryRow[];
  supplierCount: CountRow[];
  districts: DistrictRow[];
  suppliers: SupplierRow[];
  trend: TrendRow[];
};

type WindowRow = {
  _id: null;
  orders: number;
  totalKg: number;
  totalSpend: number;
};

/** Division that answers 0 rather than NaN when nothing was bought. */
function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * The UTC start of the bucket `date` falls in.
 *
 * Mirrors `$dateTrunc`, which truncates in UTC unless it is handed a timezone,
 * so the buckets this fills in line up exactly with the ones Mongo returned
 * rather than landing an hour off and doubling a bar.
 */
function truncate(date: Date, unit: TrendGranularity): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  if (unit === "day") return start;

  if (unit === "week") {
    // `$dateTrunc` starts its week on Sunday by default, and so does this.
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());

    return start;
  }

  start.setUTCDate(1);

  return start;
}

/** The bucket after `date`. */
function advance(date: Date, unit: TrendGranularity): Date {
  const next = new Date(date);

  if (unit === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (unit === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);

  return next;
}

/**
 * The trend with its empty buckets written in.
 *
 * Mongo only returns buckets that had an order in them, so a quiet fortnight
 * comes back as a missing key rather than a zero — and a bar chart drawn
 * straight off that would space the remaining bars evenly and quietly show a
 * gap in buying as steady buying.
 */
function fillTrend(
  rows: TrendRow[],
  granularity: TrendGranularity,
  from: Date | null,
  to: Date,
): TrendPoint[] {
  const byStart = new Map(
    rows.map((row) => [new Date(row._id).getTime(), row] as const),
  );

  // "All time" has no window to walk, so it starts at the earliest purchase.
  const earliest = rows.length > 0 ? new Date(rows[0]._id) : to;
  const start = truncate(from ?? earliest, granularity);
  const end = truncate(to, granularity);

  const points: TrendPoint[] = [];

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime() && points.length < MAX_TREND_BUCKETS;
    cursor = advance(cursor, granularity)
  ) {
    const row = byStart.get(cursor.getTime());

    points.push({
      start: cursor.toISOString(),
      orders: row?.orders ?? 0,
      kg: row?.kg ?? 0,
      spend: row?.spend ?? 0,
    });
  }

  return points.slice(-ANALYTICS_LIMITS.trendPoints);
}

export async function getProcurementAnalytics(
  clerkId: string,
  range: AnalyticsRange,
): Promise<ProcurementAnalyticsResult> {
  try {
    await connectDB();

    // A farmer's side of these same orders is a different question with
    // different totals — what they earned, not what it cost — so the gate says
    // that rather than the marketplace's "you cannot send offers".
    const access = await requireFactory(clerkId, GATE);

    if (!access.ok) {
      return { ok: false, status: access.status, error: access.error };
    }

    // The order book is what this reads, so it is reconciled the same way the
    // tracking screen reconciles it: a sale whose accept died halfway through
    // has no order behind it, and would otherwise be missing from the totals
    // as well as from the list. A repair that fails must not cost the mill the
    // figures it can still be shown, so it is logged and stepped over.
    try {
      await ensureOrdersForAcceptedOffers({
        clerkId,
        role: "factory",
        userId: access.factory.userId,
      });
    } catch (error) {
      console.error("[analytics] Could not reconcile accepted offers", error);
    }

    const { days, granularity } = ANALYTICS_RANGE_META[range];

    const to = new Date();
    const from =
      days === null ? null : new Date(to.getTime() - days * 86_400_000);

    const scope = {
      factoryClerkId: clerkId,
      ...(from ? { placedAt: { $gte: from } } : {}),
    };

    const [facets, previousRows] = await Promise.all([
      Order.aggregate<AnalyticsFacet>([
        { $match: scope },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  // Counted over live orders only, so "Orders" and "Total
                  // purchased" describe the same set of consignments.
                  orders: { $sum: { $cond: [IS_LIVE, 1, 0] } },
                  confirmed: {
                    $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
                  },
                  inTransit: {
                    $sum: { $cond: [{ $eq: ["$status", "in_transit"] }, 1, 0] },
                  },
                  delivered: { $sum: { $cond: [IS_DELIVERED, 1, 0] } },
                  cancelled: { $sum: { $cond: [IS_CANCELLED, 1, 0] } },
                  totalKg: { $sum: { $cond: [IS_LIVE, "$weightKg", 0] } },
                  totalSpend: { $sum: { $cond: [IS_LIVE, ORDER_VALUE, 0] } },
                  // Split by whether the leaf has actually arrived: what the
                  // mill has taken in, and what it is still waiting on.
                  settledSpend: {
                    $sum: { $cond: [IS_DELIVERED, ORDER_VALUE, 0] },
                  },
                  committedSpend: {
                    $sum: {
                      $cond: [
                        { $in: ["$status", ["confirmed", "in_transit"]] },
                        ORDER_VALUE,
                        0,
                      ],
                    },
                  },
                },
              },
            ],

            // Distinct suppliers has to be counted over every farmer in the
            // window, not the handful the league table below shows.
            supplierCount: [
              LIVE_ONLY,
              { $group: { _id: "$farmerClerkId" } },
              { $count: "value" },
            ],

            districts: [
              LIVE_ONLY,
              {
                $group: {
                  _id: "$district",
                  orders: { $sum: 1 },
                  kg: { $sum: "$weightKg" },
                  spend: { $sum: ORDER_VALUE },
                },
              },
              { $sort: { kg: -1, spend: -1 } },
            ],

            // Not filtered to live rows: a farmer's cancellations are half of
            // what the reliability figure is measuring.
            suppliers: [
              {
                $group: {
                  _id: "$farmerClerkId",
                  name: { $first: "$farmerName" },
                  orders: { $sum: { $cond: [IS_LIVE, 1, 0] } },
                  delivered: { $sum: { $cond: [IS_DELIVERED, 1, 0] } },
                  cancelled: { $sum: { $cond: [IS_CANCELLED, 1, 0] } },
                  kg: { $sum: { $cond: [IS_LIVE, "$weightKg", 0] } },
                  spend: { $sum: { $cond: [IS_LIVE, ORDER_VALUE, 0] } },
                },
              },
              // Someone whose every consignment fell through supplied nothing,
              // so they are not a supplier this table has a row for.
              { $match: { orders: { $gt: 0 } } },
              { $sort: { spend: -1, kg: -1 } },
              { $limit: ANALYTICS_LIMITS.suppliers },
            ],

            trend: [
              LIVE_ONLY,
              {
                $group: {
                  _id: {
                    $dateTrunc: { date: "$placedAt", unit: granularity },
                  },
                  orders: { $sum: 1 },
                  kg: { $sum: "$weightKg" },
                  spend: { $sum: ORDER_VALUE },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      // The window immediately before this one, for the movement figures. Not
      // asked for at all on "all time", which has nothing behind it.
      from
        ? Order.aggregate<WindowRow>([
            {
              $match: {
                factoryClerkId: clerkId,
                placedAt: {
                  $gte: new Date(from.getTime() - (days ?? 0) * 86_400_000),
                  $lt: from,
                },
              },
            },
            {
              $group: {
                _id: null,
                orders: { $sum: { $cond: [IS_LIVE, 1, 0] } },
                totalKg: { $sum: { $cond: [IS_LIVE, "$weightKg", 0] } },
                totalSpend: { $sum: { $cond: [IS_LIVE, ORDER_VALUE, 0] } },
              },
            },
          ])
        : Promise.resolve([] as WindowRow[]),
    ]);

    const facet = facets[0];

    const totals = facet?.summary[0];
    const districtRows = facet?.districts ?? [];
    const supplierRows = facet?.suppliers ?? [];

    const totalKg = totals?.totalKg ?? 0;
    const totalSpend = totals?.totalSpend ?? 0;

    const summary: ProcurementSummary = {
      orders: totals?.orders ?? 0,
      cancelled: totals?.cancelled ?? 0,
      totalKg,
      totalSpend,
      settledSpend: totals?.settledSpend ?? 0,
      committedSpend: totals?.committedSpend ?? 0,
      avgPricePerKg: ratio(totalSpend, totalKg),
      suppliers: facet?.supplierCount[0]?.value ?? 0,
      districts: districtRows.length,
    };

    const statusMix: StatusMix = {
      confirmed: totals?.confirmed ?? 0,
      inTransit: totals?.inTransit ?? 0,
      delivered: totals?.delivered ?? 0,
      cancelled: totals?.cancelled ?? 0,
    };

    const districts: DistrictBreakdown[] = districtRows.map((row) => ({
      district: row._id,
      orders: row.orders,
      kg: row.kg,
      spend: row.spend,
      avgPricePerKg: ratio(row.spend, row.kg),
      shareOfKg: ratio(row.kg, totalKg) * 100,
    }));

    // Only the few farmers on the league table need naming, so this waits on
    // the aggregate rather than joining every supplier in the window.
    const parties = await resolveTradeParties(
      supplierRows.map((row) => row._id),
    );

    const suppliers: SupplierBreakdown[] = supplierRows.map((row) => {
      const party = parties.get(row._id);
      const agreed = row.orders + row.cancelled;

      return {
        clerkId: row._id,
        // The live profile wins, so a farmer who has since finished onboarding
        // stops reading as anonymous; the name frozen on the order is what is
        // left once the account row has gone.
        name: party?.name || row.name?.trim() || "CeylonGuard farmer",
        ...(party?.district ? { district: party.district } : {}),
        orders: row.orders,
        kg: row.kg,
        spend: row.spend,
        avgPricePerKg: ratio(row.spend, row.kg),
        cancelled: row.cancelled,
        reliability: ratio(row.delivered, agreed) * 100,
      };
    });

    const before = previousRows[0];

    const previous: PeriodComparison | null =
      from && days
        ? {
            from: new Date(from.getTime() - days * 86_400_000).toISOString(),
            totalSpend: percentChange(before?.totalSpend ?? 0, totalSpend),
            totalKg: percentChange(before?.totalKg ?? 0, totalKg),
            orders: percentChange(before?.orders ?? 0, summary.orders),
            avgPricePerKg: percentChange(
              ratio(before?.totalSpend ?? 0, before?.totalKg ?? 0),
              summary.avgPricePerKg,
            ),
          }
        : null;

    return {
      ok: true,
      data: {
        range,
        granularity,
        from: from?.toISOString() ?? null,
        to: to.toISOString(),
        summary,
        statusMix,
        previous,
        trend: fillTrend(facet?.trend ?? [], granularity, from, to),
        districts,
        suppliers,
      },
    };
  } catch (error) {
    console.error("[analytics] Could not read the procurement figures", error);

    return {
      ok: false,
      status: 503,
      error: "Your procurement figures could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    };
  }
}
