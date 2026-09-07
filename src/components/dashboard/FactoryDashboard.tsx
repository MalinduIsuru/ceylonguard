import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  MapPin,
  Scale,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatKg, relativeDay } from "@/lib/dashboard";
import { formatRupees } from "@/lib/listings";
import {
  MOCK_FACTORY_LISTINGS,
  MOCK_FACTORY_OFFERS,
  MOCK_FACTORY_ORDERS,
} from "@/lib/mock/factory-dashboard";

const FactoryDashboard = () => {
  const listings = MOCK_FACTORY_LISTINGS;
  const offers = MOCK_FACTORY_OFFERS;
  const orders = MOCK_FACTORY_ORDERS;

  const availableKg = listings.reduce((sum, l) => sum + l.weightKg, 0);
  const avgPrice = listings.length
    ? Math.round(
        listings.reduce((sum, l) => sum + l.pricePerKg, 0) / listings.length,
      )
    : 0;
  const pendingOffers = offers.filter((o) => o.status === "pending").length;
  const activeOrders = orders.filter((o) => o.status !== "Delivered");
  const totalSpend = orders.reduce(
    (sum, o) => sum + o.weightKg * o.pricePerKg,
    0,
  );

  const stats = [
    {
      label: "Verified supply available",
      value: formatKg(availableKg),
      hint: `Across ${listings.length} listings`,
      icon: ShieldCheck,
    },
    {
      label: "Average asking price",
      value: `${formatRupees(avgPrice)}/kg`,
      hint: "Across all districts",
      icon: BarChart3,
    },
    {
      label: "Offers sent",
      value: String(offers.length),
      hint:
        pendingOffers === 0
          ? "None awaiting a reply"
          : `${pendingOffers} awaiting a reply`,
      icon: Store,
    },
    {
      label: "Active orders",
      value: String(activeOrders.length),
      hint: `${formatRupees(totalSpend)} committed`,
      icon: Truck,
    },
  ];

  const topListings = [...listings]
    .sort((a, b) => b.trustScore - a.trustScore)
    .slice(0, 4);
  const recentOrders = [...orders]
    .sort((a, b) => b.placedOn.localeCompare(a.placedOn))
    .slice(0, 4);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl gradient-deep p-6 text-primary-foreground sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          Ayubowan, Lipton Tea Factory
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
          <ul className="mt-4 grid gap-3">
            {topListings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-leaf-strong">
                    {listing.farmer}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {listing.district}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />{" "}
                      {formatKg(listing.weightKg)}
                    </span>
                    <span>Trust {listing.trustScore}</span>
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
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-leaf-strong">
              Recent orders
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/orders">
                All orders
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <ul className="mt-4 grid gap-3">
            {recentOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-leaf-strong">
                    {order.farmer}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatKg(order.weightKg)} ·{" "}
                    {formatRupees(order.pricePerKg)}
                    /kg · {relativeDay(order.placedOn)}
                  </p>
                </div>
                <span className="rounded-full bg-leaf-soft px-3 py-1 text-xs font-semibold text-leaf-strong">
                  {order.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default FactoryDashboard;
