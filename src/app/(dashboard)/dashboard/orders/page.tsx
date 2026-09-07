"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  CircleX,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Scale,
  Sprout,
  Store,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { chatHrefForOffer } from "@/lib/chat";
import { formatRupees } from "@/lib/listings";
import { formatHarvestAge } from "@/lib/marketplace";
import {
  ORDER_LIMITS,
  ORDER_STAGES,
  ORDER_STATUS_META,
  ORDER_TRANSITIONS,
  canTransition,
  ordersQueryString,
  stageIndex,
  type OrderFilter,
  type OrderItem,
  type OrderMove,
  type OrderRole,
  type OrderStats,
  type OrderStatus,
  type OrdersResponse,
  type UpdateOrderResponse,
} from "@/lib/orders";

/**
 * Order Tracking.
 *
 * Everything here comes from `/api/orders`: the consignments this account is a
 * party to and the totals above them. Both sides of the trade read the same
 * screen — the route says which side is asking, and the transition rules say
 * which moves that side may make, so a farmer sees the sale they are shipping
 * and the mill sees the purchase it is waiting on without either being offered
 * a button the server would refuse.
 *
 * A card that has gone stale is answered with the reload the conflict response
 * asks for, rather than being patched in place from a guess.
 */

const GENERIC_ERROR = "Your orders could not be loaded right now.";

const EMPTY_STATS: OrderStats = {
  confirmed: 0,
  inTransit: 0,
  delivered: 0,
  cancelled: 0,
  totalWeightKg: 0,
  openValue: 0,
  settledValue: 0,
};

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

/** The moves a card can offer, in the order they read on it. */
const MOVES: OrderMove[] = ["in_transit", "delivered", "cancelled"];

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestOrders(filter: OrderFilter): Promise<OrdersResponse> {
  const response = await fetch(`/api/orders${ordersQueryString(filter)}`, {
    cache: "no-store",
  });

  return (await response.json()) as OrdersResponse;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <p className="mt-1 text-2xl font-semibold leading-none text-leaf-strong">
        {value}
      </p>
    </div>
  );
}

/** "28 Aug 2026" — orders are read against a calendar, not a clock. */
function formatDay(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-LK", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/** The three-stage track, or a plain cancelled badge once it is off it. */
function StageTrack({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${ORDER_STATUS_META.cancelled.className}`}
      >
        <X className="size-3.5" /> {ORDER_STATUS_META.cancelled.label}
      </span>
    );
  }

  const reachedUpTo = stageIndex(status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ORDER_STAGES.map((stage, index) => (
        <span key={stage} className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              reachedUpTo >= index
                ? "gradient-leaf text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {ORDER_STATUS_META[stage].label}
          </span>
          {index < ORDER_STAGES.length - 1 ? (
            <span className="h-px w-6 bg-border" aria-hidden />
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** The icon that reads as the move, not as the state it comes from. */
function MoveIcon({ status }: { status: OrderStatus }) {
  if (status === "in_transit") return <Truck className="size-4" />;
  if (status === "delivered") return <PackageCheck className="size-4" />;

  return <X className="size-4" />;
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [stats, setStats] = useState<OrderStats>(EMPTY_STATS);
  const [viewerRole, setViewerRole] = useState<OrderRole>("factory");
  const [filter, setFilter] = useState<OrderFilter>("all");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Id of the card mid-request, so only that card shows as busy. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  /** The card whose cancel panel is open, and the reason typed into it. */
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  /** Bumped by the reload buttons so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  // The spinner is raised by whatever asked for the data — a filter button or
  // the reload button — rather than in here, so the effect stays a plain fetch
  // and does not re-render the page just to announce itself.
  useEffect(() => {
    let cancelled = false;

    requestOrders(filter)
      .then((payload) => {
        if (cancelled) return;

        if (payload.ok) {
          setOrders(payload.items);
          setStats(payload.stats);
          setViewerRole(payload.viewerRole);
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
  }, [filter, reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }, []);

  /** Re-reads the order book, unless the tab pressed is already showing. */
  const changeFilter = useCallback(
    (value: OrderFilter) => {
      if (value === filter) return;

      setLoading(true);
      setFilter(value);
    },
    [filter],
  );

  const move = async (order: OrderItem, status: OrderStatus) => {
    setBusyId(order.id);
    setNotice(null);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[order.id];
      return next;
    });

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "cancelled" && reason.trim()
            ? { reason: reason.trim() }
            : {}),
        }),
      });

      const payload = (await response.json()) as UpdateOrderResponse;

      if (payload.ok) {
        setCancelId(null);
        setReason("");
        setNotice(
          `${payload.order.reference} is now ${ORDER_STATUS_META[
            payload.order.status
          ].label.toLowerCase()}.`,
        );

        // The totals above move with every status change, and a cancelled
        // order leaves the default filter, so the book is pulled again rather
        // than patched from what this one response happens to know.
        reload();
      } else {
        setRowErrors((current) => ({ ...current, [order.id]: payload.error }));

        // A card answered from another screen is stale here; pull the book
        // again so it stops offering a move the server has already refused.
        if (response.status === 404 || response.status === 409) reload();
      }
    } catch {
      setRowErrors((current) => ({
        ...current,
        [order.id]: "Could not reach the CeylonGuard server.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  const isFactory = viewerRole === "factory";

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          {isFactory ? (
            <>
              <Store className="size-3.5" /> Factory Portal · Orders
            </>
          ) : (
            <>
              <Sprout className="size-3.5" /> Farmer Portal · Orders
            </>
          )}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Order Tracking
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {isFactory
            ? "Follow each confirmed purchase from offer acceptance to delivery, and update the supply chain status as leaf arrives at the factory."
            : "Every offer you accept becomes an order here. Mark a consignment as dispatched, and the factory confirms it once the leaf is weighed in."}
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

      {notice && (
        <p className="rounded-2xl bg-leaf-soft p-4 text-sm font-medium text-leaf-strong">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Awaiting dispatch" value={String(stats.confirmed)} />
        <StatTile label="In transit" value={String(stats.inTransit)} />
        <StatTile
          label="On the road"
          value={formatRupees(stats.openValue)}
        />
        <StatTile
          label={isFactory ? "Taken in" : "Delivered"}
          value={formatRupees(stats.settledValue)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "hero" : "leafOutline"}
              size="sm"
              onClick={() => changeFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={loading}
          aria-label="Reload orders"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <section className="grid gap-4">
        {orders.map((order) => {
          const busy = busyId === order.id;
          const error = rowErrors[order.id];

          // The other side of the trade: a mill reads the farmer's name on
          // the card, and a farmer reads the mill's.
          const partner = isFactory ? order.farmer : order.factory;

          const moves = MOVES.filter((status) =>
            canTransition(order.viewerRole, order.status, status),
          );
          const cancelOpen = cancelId === order.id;

          return (
            <article
              key={order.id}
              className={`surface-card p-5 transition-opacity sm:p-6 ${
                busy ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-leaf-strong">
                      {partner.name}
                    </h2>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold text-muted-foreground">
                      {order.reference}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {order.district}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />{" "}
                      {order.weightKg.toLocaleString()} kg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />{" "}
                      {formatHarvestAge(order.harvestDate)}
                    </span>
                    <span>Placed {formatDay(order.placedAt)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-leaf-strong">
                    {formatRupees(order.totalValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupees(order.pricePerKg)}/kg
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <StageTrack status={order.status} />
              </div>

              {order.status === "cancelled" && order.cancelledReason && (
                <p className="mt-4 rounded-xl bg-secondary p-3 text-sm leading-relaxed text-muted-foreground">
                  {order.cancelledReason}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {moves.map((status) =>
                  status === "cancelled" ? (
                    <Button
                      key={status}
                      variant="ghost"
                      size="lg"
                      disabled={busy}
                      onClick={() => {
                        setReason("");
                        setCancelId(cancelOpen ? null : order.id);
                      }}
                    >
                      <X className="size-4" />
                      {ORDER_TRANSITIONS.cancelled.action}
                    </Button>
                  ) : (
                    <Button
                      key={status}
                      variant={status === "delivered" ? "hero" : "leafOutline"}
                      size="lg"
                      disabled={busy}
                      onClick={() => void move(order, status)}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <MoveIcon status={status} />
                      )}
                      {ORDER_TRANSITIONS[status].action}
                    </Button>
                  ),
                )}

                {order.status === "delivered" && (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${ORDER_STATUS_META.delivered.className}`}
                  >
                    <Check className="size-4" /> Delivered and closed
                  </span>
                )}

                {/* Names the offer rather than a thread: the chat page finds
                    the conversation behind this trade, or opens one. */}
                <Button asChild variant="ghost" size="lg">
                  <Link href={chatHrefForOffer(order.offerId)}>
                    <MessageCircle className="size-4" /> Chat with{" "}
                    {partner.name}
                  </Link>
                </Button>
              </div>

              {cancelOpen && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-secondary/50 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`${order.id}-reason`}>
                      Why is this order being cancelled? (optional)
                    </Label>
                    <Input
                      id={`${order.id}-reason`}
                      className="h-12 bg-card"
                      placeholder="Lorry broke down, leaf no longer available…"
                      maxLength={ORDER_LIMITS.maxReasonLength}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Cancelling closes this order for good. The harvest stays
                    marked sold, so publish a fresh listing if the leaf is still
                    going to market.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="lg"
                      disabled={busy}
                      onClick={() => void move(order, "cancelled")}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                      Confirm cancellation
                    </Button>
                    <Button
                      variant="leafOutline"
                      size="lg"
                      disabled={busy}
                      onClick={() => setCancelId(null)}
                    >
                      Keep the order
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
            </article>
          );
        })}

        {!loading && orders.length === 0 && !loadError ? (
          <div className="surface-card grid place-items-center gap-2 p-10 text-center">
            <Truck className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? isFactory
                  ? "No orders yet. Offers you send from the marketplace appear here as confirmed purchases once the farmer accepts them."
                  : "No orders yet. Accepting an offer on one of your harvests opens a consignment here."
                : "No orders in this state right now."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default OrdersPage;
