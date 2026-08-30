"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CircleX,
  ImageOff,
  Leaf,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import ScanResult from "@/components/dashboard/disease-detect/ScanResult";
import { Button } from "@/components/ui/button";
import {
  HISTORY_PAGE_SIZE,
  historyItemToResult,
  type HistoryResponse,
  type HistoryStats,
  type ScanHistoryItem,
} from "@/lib/disease-detect";
import { SEVERITY_META } from "@/lib/disease-info";

const GENERIC_ERROR = "Your scan history could not be loaded right now.";

/** Plain request, no state: the callers decide what to do with the payload. */
async function requestHistory(skip: number): Promise<HistoryResponse> {
  const response = await fetch(
    `/api/disease-detect/history?limit=${HISTORY_PAGE_SIZE}&skip=${skip}`,
    { cache: "no-store" },
  );

  return (await response.json()) as HistoryResponse;
}

type ScanHistoryProps = {
  /** Bumped by the page after a scan saves, to pull the new row in. */
  refreshKey: number;
  /** Sends the farmer back to the scan tab from the empty state. */
  onStartScan: () => void;
  /** Lets the page badge the tab with a live count. */
  onTotalChange?: (total: number) => void;
};

/** Stat tile: label in sentence case, value in semibold sans. */
function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <p
        className={`mt-1 text-2xl font-semibold leading-none ${
          accent ?? "text-leaf-strong"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatRow({ stats }: { stats: HistoryStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Total scans" value={String(stats.total)} />

      <StatTile
        label="Healthy"
        value={String(stats.healthy)}
        accent="text-verified"
      />

      <StatTile
        label="Needs treatment"
        value={String(stats.diseased)}
        accent={stats.diseased > 0 ? "text-orange-600" : undefined}
      />

      <StatTile
        label="Avg confidence"
        value={`${stats.averageConfidence.toFixed(1)}%`}
      />
    </div>
  );
}

function HistoryCard({
  item,
  onOpen,
}: {
  item: ScanHistoryItem;
  onOpen: () => void;
}) {
  const severity = SEVERITY_META[item.severity];
  const scannedAt = new Date(item.scannedAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group surface-card overflow-hidden p-0 text-left transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-secondary">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={`Leaf scanned on ${format(scannedAt, "d MMM yyyy")}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-xs">No photo stored</span>
          </div>
        )}

        <span
          className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold shadow-sm ${severity.chip}`}
        >
          {item.isHealthy ? (
            <Leaf className="size-3" />
          ) : (
            <TriangleAlert className="size-3" />
          )}
          {severity.label}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-display text-base font-bold text-leaf-strong">
            {item.label}
          </p>

          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {item.confidence.toFixed(1)}%
          </span>
        </div>

        {/* Confidence as a meter: severity fill on a lighter track. */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${severity.bar}`}
            style={{ width: `${Math.max(2, Math.min(100, item.confidence))}%` }}
          />
        </div>

        <p
          className="mt-2.5 text-xs text-muted-foreground"
          title={format(scannedAt, "d MMM yyyy, h:mm a")}
        >
          {formatDistanceToNow(scannedAt, { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="aspect-4/3 animate-pulse bg-muted" />

      <div className="grid gap-2.5 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-1.5 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/** Full result for one archived scan, rebuilt from the stored row. */
function HistoryDetail({
  item,
  onBack,
}: {
  item: ScanHistoryItem;
  onBack: () => void;
}) {
  const scannedAt = new Date(item.scannedAt);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back to history
        </Button>

        <p className="text-xs text-muted-foreground">
          Scanned {format(scannedAt, "d MMM yyyy, h:mm a")}
        </p>
      </div>

      {item.imageUrl && (
        <div className="surface-card overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={`Leaf scanned on ${format(scannedAt, "d MMM yyyy")}`}
            className="max-h-96 w-full object-cover"
          />
        </div>
      )}

      <ScanResult result={historyItemToResult(item)} />
    </div>
  );
}

function ScanHistory({
  refreshKey,
  onStartScan,
  onTotalChange,
}: ScanHistoryProps) {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<ScanHistoryItem | null>(null);

  // Held in a ref so an inline parent callback cannot re-trigger the fetch.
  const onTotalChangeRef = useRef(onTotalChange);

  useEffect(() => {
    onTotalChangeRef.current = onTotalChange;
  }, [onTotalChange]);

  /** Bumped by the retry button so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  // First page: on mount, on retry, and whenever a new scan is archived.
  useEffect(() => {
    let cancelled = false;

    requestHistory(0)
      .then((payload) => {
        if (cancelled) return;

        if (!payload.ok) {
          setError(payload.error);
          return;
        }

        setError(null);
        setStats(payload.stats);
        setHasMore(payload.hasMore);
        setItems(payload.items);
        // A fresh first page invalidates whatever detail was open.
        setSelected(null);
        onTotalChangeRef.current?.(payload.stats.total);
      })
      .catch(() => {
        if (!cancelled) setError(GENERIC_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, reloadToken]);

  const reload = () => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  };

  /** Appends the next page. Older rows never change, so no cancellation. */
  const loadMore = async () => {
    setLoadingMore(true);

    try {
      const payload = await requestHistory(items.length);

      if (!payload.ok) {
        setError(payload.error);
        return;
      }

      setError(null);
      setHasMore(payload.hasMore);
      setItems((current) => [...current, ...payload.items]);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setLoadingMore(false);
    }
  };

  if (selected) {
    return <HistoryDetail item={selected} onBack={() => setSelected(null)} />;
  }

  if (loading) {
    return (
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[4.75rem] animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="animate-rise rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />

          <div>
            <p className="font-display text-base font-bold text-red-900">
              History unavailable
            </p>

            <p className="mt-1 text-sm leading-relaxed text-red-800">{error}</p>

            <Button
              variant="leafOutline"
              size="sm"
              className="mt-4"
              onClick={reload}
            >
              <RefreshCw className="size-4" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="surface-card animate-rise grid place-items-center gap-4 px-6 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-leaf-soft text-leaf-strong">
          <ScanLine className="size-6" />
        </span>

        <div>
          <p className="font-display text-lg font-bold text-leaf-strong">
            No scans yet
          </p>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Every leaf you scan is saved here with its diagnosis, confidence
            score and treatment plan, so you can follow a block across a season.
          </p>
        </div>

        <Button variant="hero" size="lg" onClick={onStartScan}>
          <ScanLine className="size-4" />
          Run your first scan
        </Button>
      </div>
    );
  }

  return (
    <div className="grid animate-rise gap-5">
      {stats && <StatRow stats={stats} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            onOpen={() => setSelected(item)}
          />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <CircleX className="size-4 shrink-0 text-red-600" />

          <p className="text-xs leading-relaxed text-red-800">{error}</p>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="leafOutline"
            size="lg"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            <RefreshCw className={`size-4 ${loadingMore ? "animate-spin" : ""}`} />
            {loadingMore ? "Loading…" : "Load older scans"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ScanHistory;
