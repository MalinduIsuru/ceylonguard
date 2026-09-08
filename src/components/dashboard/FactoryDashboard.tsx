import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleX,
  MapPin,
  Scale,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatKg,
  relativeDay,
  type FactoryDashboardData,
  type SupplierRecord,
} from "@/lib/dashboard";
import { formatRupees } from "@/lib/listings";
import { formatHarvestAge } from "@/lib/marketplace";
import { ORDER_STATUS_META } from "@/lib/orders";

/**
 * Factory home.
 *
 * Presentation only: every figure arrives as `data`, read in one pass by
 * `getFactoryDashboard` on the page above. When that read fails the page still
 * renders — an empty workspace with `error` set — rather than replacing the
 * whole screen with an error.
 */

type FactoryDashboardProps = {
  data: FactoryDashboardData;
  /** Falls back to a neutral greeting when the mill has no name onboarded. */
  factoryName?: string;
  /** Set when the figures could not be read. */
  error?: string;
};

/**
 * The seller's standing, or that they do not have one yet.
 *
 * A farmer nobody has completed a trade with reads as new rather than as
 * untrustworthy — there is nothing on the record either way, and a 0 would say
 * something the data does not.
 */
function RecordBadge({ record }: { record?: SupplierRecord }) {
  if (!record) {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
        New supplier
      </span>
    );
  }

  const perfect = record.cancelled === 0;

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold ${
        perfect ? "bg-leaf-soft text-leaf-strong" : "bg-amber-50 text-amber-800"
      }`}
    >
      {record.delivered}/{record.delivered + record.cancelled} delivered
    </span>
  );
}

const FactoryDashboard = ({
  data,
  factoryName = "there",
  error,
}: FactoryDashboardProps) => {
  const { supply, offers, purchases } = data;

  const stats = [
    {
      label: "Supply available",
      value: formatKg(supply.availableKg),
      hint:
        supply.listings === 0
          ? "Nothing on the marketplace right now"
          : `Across ${supply.listings} ${
              supply.listings === 1 ? "listing" : "listings"
            } in ${supply.districts} ${
              supply.districts === 1 ? "district" : "districts"
            }`,
      icon: ShieldCheck,
    },
    {
      label: "Average asking price",
      value: `${formatRupees(supply.avgPricePerKg)}/kg`,
      hint:
        supply.availableKg === 0
          ? "No open stock to price"
          : `${formatRupees(supply.askingValue)} of stock on offer`,
      icon: BarChart3,
    },
    {
      label: "Offers sent",
      value: String(offers.total),
      hint:
        offers.pending === 0
          ? "None awaiting a reply"
          : `${offers.pending} awaiting a reply · ${formatRupees(
              offers.pendingValue,
            )} on the table`,
      icon: Store,
    },
    {
      label: "Active orders",
      value: String(purchases.active),
      hint:
        purchases.active === 0
          ? `${formatRupees(purchases.settledValue)} taken in so far`
          : `${formatRupees(purchases.committedValue)} committed`,
      icon: Truck,
    },
  ];

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl gradient-deep p-6 text-primary-foreground sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          Ayubowan, {factoryName}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Procurement Overview
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-85">
          A single view of verified harvest supply, the offers you have sent and
          how your orders are moving.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="soft" size="lg">
            <Link href="/dashboard/marketplace">
              <Store className="size-4" /> Browse marketplace
            </Link>
          </Button>
          <Button asChild variant="soft" size="lg">
            <Link href="/dashboard/orders">
              <Truck className="size-4" /> Track orders
            </Link>
          </Button>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p className="text-sm leading-relaxed text-red-800">{error}</p>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="surface-card p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-leaf-soft text-leaf-strong">
              <stat.icon className="size-5" />
            </span>
            <p className="mt-4 font-display text-2xl font-bold text-leaf-strong">
              {stat.value}
            </p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-leaf-strong">
              Top trusted listings
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/marketplace">
                Browse <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {supply.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No open stock right now. Harvests appear here the moment a farmer
              publishes one.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {supply.recent.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-leaf-strong">
                        {listing.farmer}
                      </p>
                      <RecordBadge record={listing.record} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {listing.district}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Scale className="size-3.5" />{" "}
                        {formatKg(listing.weightKg)}
                      </span>
                      <span>{formatHarvestAge(listing.harvestDate)}</span>
                    </div>
                  </div>
                  <p className="font-display text-lg font-bold text-leaf-strong">
                    {formatRupees(listing.pricePerKg)}
                    <span className="text-xs font-medium text-muted-foreground">
                      /kg
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-leaf-strong">
                Recent orders
              </h2>
              {purchases.delivered > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatKg(purchases.totalKg)} bought ·{" "}
                  {purchases.delivered} delivered
                </p>
              )}
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/orders">
                All orders
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {purchases.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No orders yet. An offer becomes a consignment here the moment a
              farmer accepts it.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {purchases.recent.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-leaf-strong">
                      {order.farmer.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatKg(order.weightKg)} ·{" "}
                      {formatRupees(order.pricePerKg)}
                      /kg · {relativeDay(order.placedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_META[order.status].className}`}
                  >
                    {ORDER_STATUS_META[order.status].label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default FactoryDashboard;
