import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  ScanLine,
  ShieldCheck,
  Store,
  Tag,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { STATUS_META, formatRupees } from "@/lib/listings";
import { RECEIVED_STATUS_META, type OfferStatus } from "@/lib/offers";
import {
  MOCK_FARMER_NAME,
  MOCK_LISTINGS,
  MOCK_OFFERS,
  MOCK_SCANS,
  MOCK_TRUST_SCORE,
  MOCK_VERIFIED_SCAN,
} from "@/lib/mock/farmer-dashboard";

/**
 * Farmer home.
 *
 * Display only: every figure comes from `@/lib/mock/farmer-dashboard`, which
 * mirrors the `/api/listings` and `/api/offers` shapes, so the fetches can be
 * dropped in later without touching this markup.
 */

/** Short badge text — the offers page has room for the full sentence. */
const OFFER_BADGE: Record<OfferStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

/** "Today", "Yesterday" or "N days ago" for an ISO timestamp. */
function age(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";

  return `${days} days ago`;
}

type FarmerDashboardProps = {
  /** Falls back to the mock farmer when the page has no signed-in name. */
  userName?: string;
};

const FarmerDashboard = ({
  userName = MOCK_FARMER_NAME,
}: FarmerDashboardProps) => {
  const scans = MOCK_SCANS;
  const listings = MOCK_LISTINGS;
  const offers = MOCK_OFFERS;
  const verifiedScan = MOCK_VERIFIED_SCAN;

  const activeListings = listings.filter(
    (listing) => listing.status === "active",
  );
  const pendingOffers = offers.filter((offer) => offer.status === "pending");

  const stats = [
    {
      label: "Leaf scans",
      value: scans.length,
      icon: ScanLine,
    },
    {
      label: "Active listings",
      value: activeListings.length,
      icon: Store,
    },
    {
      label: "Pending offers",
      value: pendingOffers.length,
      icon: Tag,
    },
    {
      label: "Trust score",
      value: `${MOCK_TRUST_SCORE} / 100`,
      icon: TrendingUp,
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
          Verify a leaf as disease free, publish your harvest and negotiate
          directly with factory buyers — no middleman required.
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
          </div>
        ))}
      </section>

      <section
        className={`surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center ${
          verifiedScan ? "border-leaf/40" : ""
        }`}
      >
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${
            verifiedScan
              ? "gradient-leaf text-primary-foreground"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <ShieldCheck className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-leaf-strong">
            {verifiedScan
              ? "AI Disease Free Stamp active"
              : "Marketplace listing locked"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {verifiedScan
              ? `Verified as ${verifiedScan.label} with ${verifiedScan.confidence.toFixed(1)}% confidence. You can publish a harvest listing now.`
              : "A leaf must be classified as Healthy by the AI model before you can create a marketplace listing."}
          </p>
        </div>
        <Button
          asChild
          variant={verifiedScan ? "hero" : "leafOutline"}
          size="lg"
        >
          <Link
            href={
              verifiedScan ? "/dashboard/listings" : "/dashboard/disease-detect"
            }
          >
            {verifiedScan ? "Post harvest" : "Verify a leaf"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="font-display text-lg font-bold text-leaf-strong">
            Recent scans
          </h2>
          {scans.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No scans yet. Upload or capture a tea leaf photo to run the
              MobileNetV2 diagnostic engine.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {scans.slice(0, 4).map((scan) => (
                <li
                  key={scan.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-leaf-strong">
                      {scan.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {age(scan.scannedAt)}
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
          {offers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No offers yet. Factories bid once your harvest is on the
              marketplace.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {offers.slice(0, 3).map((offer) => (
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
          <h2 className="font-display text-lg font-bold text-leaf-strong">
            Your harvests
          </h2>
          <Button asChild variant="leafOutline" size="sm">
            <Link href="/dashboard/listings">
              Manage listings
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {listings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing published yet. A verified harvest reaches every registered
            factory the moment you post it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {listings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-leaf-strong">
                    {listing.weightKg} kg · {formatRupees(listing.pricePerKg)}
                    /kg
                    {listing.verification && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-semibold text-leaf-strong">
                        <ShieldCheck className="size-3.5" /> Verified
                      </span>
                    )}
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
