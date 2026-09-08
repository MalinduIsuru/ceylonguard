"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleX,
  Coins,
  MapPin,
  RefreshCw,
  Scale,
  Store,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ANALYTICS_LIMITS,
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_META,
  DEFAULT_ANALYTICS_RANGE,
  EMPTY_SUMMARY,
  analyticsQueryString,
  formatChange,
  formatKilos,
  formatTrendLabel,
  formatTrendSpan,
  type AnalyticsRange,
  type AnalyticsResponse,
  type ProcurementAnalytics,
} from "@/lib/analytics";
import { formatRupees } from "@/lib/listings";

/**
 * Procurement Analytics.
 *
 * Every figure comes from `/api/analytics`, which aggregates the mill's own
 * order book in Mongo. Nothing is summed here: the page only ever holds the
 * summary, so narrowing the window is a request rather than a re-derivation,
 * and a factory with three seasons of purchases behind it is not shipping its
 * whole order book to the browser to draw four tiles.
 *
 * Movement against the previous window is shown in plain ink rather than red
 * and green. Spending more is not good news or bad news on its own — it
 * depends on what the mill meant to do — so the arrow states the direction and
 * leaves the reading to whoever knows the plan.
 */

const GENERIC_ERROR = "Your procurement figures could not be loaded right now.";

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestAnalytics(
  range: AnalyticsRange,
): Promise<AnalyticsResponse> {
  const response = await fetch(`/api/analytics${analyticsQueryString(range)}`, {
    cache: "no-store",
  });

  return (await response.json()) as AnalyticsResponse;
}

/** Direction and size of a move, or nothing when there is no baseline. */
function Delta({ value }: { value: number | null }) {
  if (value === null || Math.round(value) === 0) return null;

  const rising = value > 0;

  return (
    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      {rising ? (
        <ArrowUpRight className="size-3.5" />
      ) : (
        <ArrowDownRight className="size-3.5" />
      )}
      {formatChange(value)} vs previous
    </span>
  );
}

function StatTile({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: typeof Coins;
}) {
  return (
    <div className="surface-card p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-leaf-soft text-leaf-strong">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-display text-2xl font-bold text-leaf-strong">
        {value}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
      <Delta value={delta} />
    </div>
  );
}

/**
 * Spend over time, one bar per bucket.
 *
 * Spend alone, not spend and weight together: they are measures of different
 * size, and putting both on one frame would need a second scale that makes the
 * two series cross wherever the axes happen to be pinned. The weight is on the
 * tooltip, where it can be read against the bar it belongs to.
 */
function TrendChart({ data }: { data: ProcurementAnalytics }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points = data.trend;
  const peak = Math.max(...points.map((point) => point.spend), 0);

  // Enough labels to place the bars in time, few enough that they do not
  // collide once a 30-day window is drawn on a phone.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  const active = hovered === null ? null : points[hovered];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-strong">
          <TrendingUp className="size-4" /> Spend over time
        </h2>

        <p className="text-xs text-muted-foreground">
          {ANALYTICS_RANGE_META[data.range].label} ·{" "}
          {data.granularity === "day"
            ? "daily"
            : data.granularity === "week"
              ? "weekly"
              : "monthly"}
        </p>
      </div>

      <div className="relative mt-6">
        {active && (
          <div className="pointer-events-none absolute -top-1 right-0 z-10 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm">
            <p className="font-semibold text-leaf-strong">
              {formatTrendSpan(active.start, data.granularity)}
            </p>
            <p className="mt-1 text-muted-foreground">
              {formatRupees(active.spend)} · {formatKilos(active.kg)} ·{" "}
              {active.orders} {active.orders === 1 ? "order" : "orders"}
            </p>
          </div>
        )}

        <div className="flex h-40 items-end gap-0.5">
          {points.map((point, index) => (
            <button
              key={point.start}
              type="button"
              className="group flex h-full flex-1 cursor-default flex-col justify-end"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              aria-label={`${formatTrendSpan(point.start, data.granularity)}: ${formatRupees(point.spend)} across ${formatKilos(point.kg)}`}
            >
              {/* A 4px cap, not the theme's 16px `lg` radius: these bars are
                  a few pixels wide, and the token would round them away. */}
              <span
                className={`w-full rounded-t-lg transition-colors ${
                  hovered === index ? "bg-leaf-strong" : "bg-leaf"
                }`}
                style={{
                  height: `${peak > 0 ? (point.spend / peak) * 100 : 0}%`,
                }}
              />
            </button>
          ))}
        </div>

        <div className="mt-2 h-px bg-border" />

        <div className="mt-2 flex gap-0.5">
          {points.map((point, index) => (
            <span
              key={point.start}
              className="flex-1 truncate text-center text-[0.65rem] text-muted-foreground"
            >
              {index % labelEvery === 0
                ? formatTrendLabel(point.start, data.granularity)
                : ""}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const AnalyticsPage = () => {
  const [data, setData] = useState<ProcurementAnalytics | null>(null);
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_ANALYTICS_RANGE);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Bumped by the reload button so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    requestAnalytics(range)
      .then((payload) => {
        if (cancelled) return;

        if (payload.ok) {
          setData(payload.data);
          setLoadError(null);
        } else {
          setLoadError(payload.error || GENERIC_ERROR);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(GENERIC_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }, []);

  const changeRange = useCallback(
    (value: AnalyticsRange) => {
      if (value === range) return;

      setLoading(true);
      setRange(value);
    },
    [range],
  );

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const previous = data?.previous ?? null;

  const districts = (data?.districts ?? []).slice(
    0,
    ANALYTICS_LIMITS.districts,
  );
  const suppliers = data?.suppliers ?? [];

  /** Bars are read against the heaviest district, not against the total. */
  const topKg = districts[0]?.kg ?? 0;

  const nothingBought = Boolean(
    data && summary.orders === 0 && summary.cancelled === 0,
  );

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Store className="size-3.5" /> Factory Portal · Analytics
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Procurement Analytics
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A live summary of what your factory has bought, what it cost and which
          supplier districts deliver the most leaf. Cancelled consignments are
          counted but never priced in.
        </p>
      </header>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />

          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-red-800">{loadError}</p>

            <Button
              variant="leafOutline"
              size="sm"
              className="mt-3"
              onClick={reload}
            >
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ANALYTICS_RANGES.map((option) => (
            <Button
              key={option}
              variant={range === option ? "hero" : "leafOutline"}
              size="sm"
              onClick={() => changeRange(option)}
            >
              {ANALYTICS_RANGE_META[option].label}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={loading}
          aria-label="Reload analytics"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total spend"
          value={formatRupees(summary.totalSpend)}
          delta={previous?.totalSpend ?? null}
          icon={Coins}
        />
        <StatTile
          label="Total purchased"
          value={formatKilos(summary.totalKg)}
          delta={previous?.totalKg ?? null}
          icon={Scale}
        />
        <StatTile
          label="Average price"
          value={`${formatRupees(summary.avgPricePerKg)}/kg`}
          delta={previous?.avgPricePerKg ?? null}
          icon={TrendingUp}
        />
        <StatTile
          label="Orders"
          value={summary.orders.toLocaleString()}
          delta={previous?.orders ?? null}
          icon={BarChart3}
        />
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Users className="size-4" /> {summary.suppliers}{" "}
          {summary.suppliers === 1 ? "supplier" : "suppliers"} across{" "}
          {summary.districts}{" "}
          {summary.districts === 1 ? "district" : "districts"}
        </span>
        <span className="flex items-center gap-2">
          <Truck className="size-4" /> {data?.statusMix.delivered ?? 0}{" "}
          delivered · {data?.statusMix.inTransit ?? 0} in transit ·{" "}
          {data?.statusMix.confirmed ?? 0} awaiting dispatch
        </span>
        <span>
          {formatRupees(summary.settledSpend)} taken in ·{" "}
          {formatRupees(summary.committedSpend)} on the road
        </span>
        {summary.cancelled > 0 && (
          <span>
            {summary.cancelled} cancelled, not counted in any total above
          </span>
        )}
      </div>

      {nothingBought ? (
        <div className="surface-card grid place-items-center gap-2 p-10 text-center">
          <BarChart3 className="size-6 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Nothing bought in this window yet. Offers you send from the
            marketplace become orders once a farmer accepts them, and those
            orders are what these figures read.
          </p>
        </div>
      ) : (
        <>
          {data && data.trend.length > 0 && <TrendChart data={data} />}

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="surface-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-strong">
                <MapPin className="size-4" /> Top supplier districts
              </h2>

              <ul className="mt-5 grid gap-4">
                {districts.map((row) => (
                  <li key={row.district}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-leaf-strong">
                        {row.district}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {formatKilos(row.kg)} · {formatRupees(row.spend)}
                      </span>
                    </div>

                    <Progress
                      value={topKg > 0 ? (row.kg / topKg) * 100 : 0}
                      className="mt-2 **:data-[slot=progress-track]:h-2"
                    />

                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {formatRupees(row.avgPricePerKg)}/kg ·{" "}
                      {Math.round(row.shareOfKg)}% of intake
                    </p>
                  </li>
                ))}

                {/* Only once a reading has actually come back: an empty list
                    mid-request is a request in flight, not an empty window. */}
                {!loading && districts.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No districts have supplied leaf in this window.
                  </li>
                )}
              </ul>
            </section>

            <section className="surface-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-strong">
                <Users className="size-4" /> Top suppliers
              </h2>

              <ul className="mt-5 grid gap-4">
                {suppliers.map((row) => (
                  <li
                    key={row.clerkId}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-leaf-strong">
                        {row.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.district ? `${row.district} · ` : ""}
                        {row.orders} {row.orders === 1 ? "order" : "orders"} ·{" "}
                        {formatKilos(row.kg)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Math.round(row.reliability)}% delivered
                        {row.cancelled > 0
                          ? ` · ${row.cancelled} cancelled`
                          : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-leaf-strong">
                        {formatRupees(row.spend)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRupees(row.avgPricePerKg)}/kg
                      </p>
                    </div>
                  </li>
                ))}

                {!loading && suppliers.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No farmers have supplied leaf in this window.
                  </li>
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
