import Link from "next/link";
import {
  ArrowRight,
  CircleX,
  Coins,
  MapPin,
  ScanLine,
  Store,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatKg,
  relativeDay,
  type FarmerDashboardData,
} from "@/lib/dashboard";
import { STATUS_META, formatRupees } from "@/lib/listings";
import { RECEIVED_STATUS_META, type OfferStatus } from "@/lib/offers";

/**
 * Farmer home.
 *
 * Presentation only: every figure arrives as `data`, read in one pass by
 * `getFarmerDashboard` on the page above. When that read fails the page still
 * renders — an empty workspace with `error` set — rather than replacing the
 * whole screen with an error.
 */

/** Short badge text — the offers page has room for the full sentence. */
const OFFER_BADGE: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

type FarmerDashboardProps = {
  data: FarmerDashboardData;
  /** Falls back to a neutral greeting when the page has no signed-in name. */
  userName?: string;
  /** Set when the figures could not be read. */
  error?: string;
};

const FarmerDashboard = ({
  data,
  userName = "farmer",
  error,
}: FarmerDashboardProps) => {
  const { scans, listings, offers } = data;

  const stats = [
    {
      label: "Leaf scans",
      value: scans.total,
      hint:
        scans.total === 0
          ? "Check your first leaf"
          : `${scans.healthy} healthy · ${scans.diseased} need care`,
      icon: ScanLine,
    },
    {
      label: "Active listings",
      value: listings.active,
      hint:
        listings.active === 0
          ? "Nothing on the marketplace"
          : `${formatKg(listings.activeWeightKg)} asking ${formatRupees(listings.activeValue)}`,
      icon: Store,
    },
    {
      label: "Pending offers",
      value: offers.pending,
      hint:
        offers.pending === 0
          ? "No bids waiting on you"
          : `${formatRupees(offers.pendingValue)} on the table`,
      icon: Tag,
    },
    {
      label: "Earned from sales",
      value: formatRupees(offers.earnings),
      hint:
        offers.accepted === 0
          ? "No harvest sold yet"
          : `Across ${offers.accepted} accepted ${
              offers.accepted === 1 ? "offer" : "offers"
            }`,
      icon: Coins,
    },
  ];

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-3xl gradient-deep p-6 text-primary-foreground sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          Ayubowan, {userName}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
          Your Farmer Workspace
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-85">
          Check a leaf for disease, publish your harvest and negotiate directly
          with factory buyers — no middleman required.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="soft" size="lg">
            <Link href="/dashboard/disease-detect">
              <ScanLine className="size-4" /> Scan a leaf
            </Link>
          </Button>
          <Button asChild variant="soft" size="lg">
            <Link href="/dashboard/listings">
              <Store className="size-4" /> Post a listing
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
          <div key={stat.label} className="surface-card p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-leaf-soft text-leaf-strong">
              <stat.icon className="size-5" />
            </span>
            <p className="mt-4 font-display text-2xl font-bold text-leaf-strong">
              {stat.value}
            </p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-xs text-muted-foreground/80">{stat.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="font-display text-lg font-bold text-leaf-strong">
            Recent scans
          </h2>
          {scans.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No scans yet. Upload or capture a tea leaf photo to run the
              MobileNetV2 diagnostic engine.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {scans.recent.map((scan) => (
                <li
                  key={scan.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-leaf-strong">
                      {scan.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {relativeDay(scan.scannedAt)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      scan.isHealthy ? "text-leaf-strong" : "text-amber-700"
                    }`}
                  >
                    {scan.confidence.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="ghost" size="lg" className="mt-4 w-full">
            <Link href="/dashboard/disease-detect">
              <ScanLine className="size-4" /> Open disease detection
            </Link>
          </Button>
        </div>

        <div className="surface-card p-6">
          <h2 className="font-display text-lg font-bold text-leaf-strong">
            Buyer activity
          </h2>
          {offers.bestPricePerKg > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Best standing bid {formatRupees(offers.bestPricePerKg)}/kg
            </p>
          )}
          {offers.recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No offers yet. Factories bid once your harvest is on the
              marketplace.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {offers.recent.map((offer) => (
                <li
                  key={offer.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-leaf-strong">
                      {offer.factory}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatRupees(offer.pricePerKg)}/kg · {offer.weightKg} kg
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${RECEIVED_STATUS_META[offer.status].className}`}
                  >
                    {OFFER_BADGE[offer.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="ghost" size="lg" className="mt-4 w-full">
            <Link href="/dashboard/offers">
              <Tag className="size-4" /> Review offers
            </Link>
          </Button>
        </div>
      </section>

      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-leaf-strong">
              Your harvests
            </h2>
            {listings.total > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {listings.active} active · {listings.sold} sold ·{" "}
                {listings.total} published in total
              </p>
            )}
          </div>
          <Button asChild variant="leafOutline" size="sm">
            <Link href="/dashboard/listings">
              Manage listings
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {listings.recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing published yet. Your harvest reaches every registered
            factory the moment you post it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {listings.recent.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-leaf-strong">
                    {listing.weightKg} kg · {formatRupees(listing.pricePerKg)}
                    /kg
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {listing.district} · harvested {listing.harvestDate}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-base font-bold text-leaf-strong">
                    {formatRupees(listing.totalValue)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[listing.status].className}`}
                  >
                    {STATUS_META[listing.status].label}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default FarmerDashboard;
