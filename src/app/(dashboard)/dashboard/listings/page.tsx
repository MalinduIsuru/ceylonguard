"use client";

import Link from "next/link";
import {
  CalendarDays,
  CircleX,
  Loader2,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sprout,
  Store,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STATUS_META,
  formatRupees,
  todayString,
  validateListingInput,
  type AvailableStamp,
  type CreateListingResponse,
  type DeleteListingResponse,
  type ListingFieldErrors,
  type ListingItem,
  type ListingStats,
  type ListingStatus,
  type ListingsResponse,
  type UpdateListingResponse,
} from "@/lib/listings";

/**
 * Post a Harvest Listing.
 *
 * Everything on this page comes from `/api/listings`: the published rows, the
 * totals above them, and the AI Disease Free Stamp the farmer has left to
 * spend. The form only says whether to use that stamp — the server picks which
 * scan it is, so the badge cannot be claimed without a healthy scan behind it.
 */

const GENERIC_ERROR = "Your listings could not be loaded right now.";

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestListings(): Promise<ListingsResponse> {
  const response = await fetch("/api/listings", { cache: "no-store" });

  return (await response.json()) as ListingsResponse;
}

const EMPTY_STATS: ListingStats = {
  active: 0,
  verified: 0,
  totalWeightKg: 0,
  averagePricePerKg: 0,
};

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

const ListingsPage = () => {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [stats, setStats] = useState<ListingStats>(EMPTY_STATS);
  const [stamp, setStamp] = useState<AvailableStamp | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ListingFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Id of the row mid-request, so only that card shows as busy. */
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Bumped by the reload buttons so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    requestListings()
      .then((payload) => {
        if (cancelled) return;

        if (payload.ok) {
          setListings(payload.items);
          setStats(payload.stats);
          setStamp(payload.stamp);
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
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }, []);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // `currentTarget` is null once the first await resolves, so hold the form.
    const form = event.currentTarget;
    const data = new FormData(form);

    const input = {
      weightKg: data.get("weight"),
      pricePerKg: data.get("price"),
      district: data.get("district"),
      harvestDate: data.get("date"),
      useStamp: stamp !== null,
    };

    const validated = validateListingInput(input);

    if (!validated.ok) {
      setFieldErrors(validated.errors);
      setFormError("Check the highlighted fields and try again.");
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as CreateListingResponse;

      if (payload.ok) {
        form.reset();
        setListings((current) => [payload.listing, ...current]);
        setStats((current) => ({
          active: current.active + 1,
          verified: current.verified + (payload.verified ? 1 : 0),
          totalWeightKg: current.totalWeightKg + payload.listing.weightKg,
          averagePricePerKg:
            (current.averagePricePerKg * current.active +
              payload.listing.pricePerKg) /
            (current.active + 1),
        }));

        // The stamp is spent, so the next listing starts unverified.
        if (payload.verified) setStamp(null);

        setNotice(
          payload.verified
            ? "Listing published with the AI Disease Free Stamp attached."
            : "Listing published. Run a leaf scan to add the AI Disease Free Stamp to your next one.",
        );
      } else {
        setFieldErrors(payload.fieldErrors ?? {});
        setFormError(payload.error);
      }
    } catch {
      setFormError(
        "Could not reach the CeylonGuard server. Check your connection.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (id: string, status: ListingStatus) => {
    setBusyId(id);
    setNotice(null);

    try {
      const response = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as UpdateListingResponse;

      if (payload.ok) {
        setListings((current) =>
          current.map((row) => (row.id === id ? payload.listing : row)),
        );
        // Totals and the free stamp both move with status; refetch rather than
        // trying to reproduce the aggregation here.
        reload();
      } else {
        setLoadError(payload.error);
      }
    } catch {
      setLoadError("Could not reach the CeylonGuard server.");
    } finally {
      setBusyId(null);
    }
  };

  const removeListing = async (id: string) => {
    setBusyId(id);
    setNotice(null);

    try {
      const response = await fetch(`/api/listings/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as DeleteListingResponse;

      if (payload.ok) {
        setListings((current) => current.filter((row) => row.id !== id));
        reload();
      } else {
        setLoadError(payload.error);
      }
    } catch {
      setLoadError("Could not reach the CeylonGuard server.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Sprout className="size-3.5" /> Farmer Portal · Harvest Marketplace
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Post a Listing
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Publish your available stock so matched factory managers can send
          offers directly. A leaf scan is optional — it just adds the AI Disease
          Free Stamp to your listing.
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Active listings" value={String(stats.active)} />
        <StatTile label="Verified" value={String(stats.verified)} />
        <StatTile
          label="Stock listed"
          value={`${stats.totalWeightKg.toLocaleString()} kg`}
        />
        <StatTile
          label="Avg price"
          value={
            stats.averagePricePerKg > 0
              ? `${formatRupees(stats.averagePricePerKg)}/kg`
              : "—"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span
              className={`grid size-10 place-items-center rounded-xl ${
                stamp
                  ? "gradient-leaf text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-leaf-strong">
                {stamp
                  ? "AI Disease Free Stamp attached"
                  : "Listing open · scan optional"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stamp
                  ? `Healthy leaf · ${stamp.confidence.toFixed(1)}% confidence`
                  : "You can publish now. Adding a leaf scan boosts buyer trust."}
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={publish}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="weight">Total weight (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  min={1}
                  className="h-12"
                  placeholder="250"
                  aria-invalid={Boolean(fieldErrors.weightKg)}
                  required
                />
                <FieldError message={fieldErrors.weightKg} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Asking price (Rs. / kg)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min={1}
                  className="h-12"
                  placeholder="130"
                  aria-invalid={Boolean(fieldErrors.pricePerKg)}
                  required
                />
                <FieldError message={fieldErrors.pricePerKg} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  name="district"
                  className="h-12"
                  placeholder="Nuwara Eliya"
                  aria-invalid={Boolean(fieldErrors.district)}
                  required
                />
                <FieldError message={fieldErrors.district} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Harvest date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  max={todayString()}
                  className="h-12"
                  aria-invalid={Boolean(fieldErrors.harvestDate)}
                  required
                />
                <FieldError message={fieldErrors.harvestDate} />
              </div>
            </div>

            <Button
              type="submit"
              variant="hero"
              size="xl"
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Publishing…" : "Publish listing"}
            </Button>

            {!stamp && (
              <Button asChild variant="soft" size="lg">
                <Link href="/dashboard/disease-detect">
                  Optional: run a leaf scan first
                </Link>
              </Button>
            )}
          </form>

          {formError && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {formError}
            </p>
          )}

          {notice && (
            <p className="mt-5 rounded-xl bg-leaf-soft p-3 text-sm text-leaf-strong">
              {notice}
            </p>
          )}
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-leaf-strong">
              My listings
            </h2>

            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Reload listings"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {loading && listings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading your listings…
            </p>
          ) : listings.length === 0 ? (
            <div className="mt-4 grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
              <Store className="size-6 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                No published harvests yet. Your listings appear here with live
                buyer match counts.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {listings.map((listing) => {
                const status = STATUS_META[listing.status];
                const busy = busyId === listing.id;

                return (
                  <li
                    key={listing.id}
                    className={`rounded-2xl border border-leaf/25 bg-leaf-soft/40 p-4 transition-opacity ${
                      busy ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-lg font-bold text-leaf-strong">
                        {formatRupees(listing.pricePerKg)}/kg
                      </p>
                      <span className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-leaf-strong">
                        <ShieldCheck className="size-3.5" />
                        {listing.verification ? "Verified" : "Unverified"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span className="flex items-center gap-1.5">
                        <Scale className="size-3.5" /> {listing.weightKg} kg
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {listing.district}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />{" "}
                        {listing.harvestDate}
                      </span>
                      <span className="font-semibold text-leaf-strong">
                        {formatRupees(listing.totalValue)} total
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-leaf/20 pt-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        {listing.status === "active" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(listing.id, "sold")
                              }
                            >
                              Mark sold
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(listing.id, "withdrawn")
                              }
                            >
                              Withdraw
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void changeStatus(listing.id, "active")
                            }
                          >
                            Re-open
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void removeListing(listing.id)}
                          aria-label="Delete listing"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ListingsPage;
