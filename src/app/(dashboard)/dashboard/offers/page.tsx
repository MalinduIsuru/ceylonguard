"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  CircleX,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Scale,
  Sprout,
  Tag,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { chatHrefForOffer } from "@/lib/chat";
import { formatRupees } from "@/lib/listings";
import { formatHarvestAge } from "@/lib/marketplace";
import {
  RECEIVED_STATUS_META,
  formatOfferDelta,
  offerDelta,
  offersQueryString,
  type DecideOfferResponse,
  type OfferDecision,
  type OfferFilter,
  type OffersResponse,
  type ReceivedOffer,
} from "@/lib/offers";

/**
 * Offers Received.
 *
 * Everything here comes from `/api/offers`: the bids on this farmer's
 * harvests and the totals above them. Accepting is a single call — the server
 * marks the harvest sold and closes the rival bids — so the page never has to
 * orchestrate that itself, and a card that has gone stale is answered with the
 * reload the conflict response asks for.
 */

const GENERIC_ERROR = "Your offers could not be loaded right now.";

const FILTERS: { value: OfferFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestOffers(filter: OfferFilter): Promise<OffersResponse> {
  const response = await fetch(`/api/offers${offersQueryString(filter)}`, {
    cache: "no-store",
  });

  return (await response.json()) as OffersResponse;
}

const OffersPage = () => {
  const [offers, setOffers] = useState<ReceivedOffer[]>([]);
  const [filter, setFilter] = useState<OfferFilter>("all");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Id of the card mid-request, so only that card shows as busy. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  /** Bumped by the reload buttons so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  // The spinner is raised by whatever asked for the data — a filter button or
  // the reload button — rather than in here, so the effect stays a plain fetch
  // and does not re-render the page just to announce itself.
  useEffect(() => {
    let cancelled = false;

    requestOffers(filter)
      .then((payload) => {
        if (cancelled) return;

        if (payload.ok) {
          setOffers(payload.items);
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

  /** Re-reads the inbox, unless the tab that was pressed is already showing. */
  const changeFilter = useCallback(
    (value: OfferFilter) => {
      if (value === filter) return;

      setLoading(true);
      setFilter(value);
    },
    [filter],
  );

  const decide = async (offer: ReceivedOffer, status: OfferDecision) => {
    setBusyId(offer.id);
    setNotice(null);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[offer.id];
      return next;
    });

    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as DecideOfferResponse;

      if (payload.ok) {
        if (payload.listingSold) {
          // Accepting moves more than this one row — the harvest is sold and
          // the rival bids are closed — so the inbox is pulled again rather
          // than patched in place.
          setNotice(
            `Offer from ${payload.offer.factory} accepted at ${formatRupees(
              payload.offer.pricePerKg,
            )}/kg. The harvest is now marked sold${
              payload.declined > 0
                ? ` and ${payload.declined} other ${
                    payload.declined === 1 ? "offer was" : "offers were"
                  } declined`
                : ""
            }.`,
          );
          reload();
        } else {
          setOffers((current) =>
            current.map((row) => (row.id === offer.id ? payload.offer : row)),
          );
        }
      } else {
        setRowErrors((current) => ({ ...current, [offer.id]: payload.error }));

        // A row answered elsewhere, or a harvest sold in the meantime, is
        // stale on screen; pull the inbox again so it stops being actionable.
        if (response.status === 404 || response.status === 409) reload();
      }
    } catch {
      setRowErrors((current) => ({
        ...current,
        [offer.id]: "Could not reach the CeylonGuard server.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Sprout className="size-3.5" /> Farmer Portal · Marketplace
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Offers Received
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Factory managers who find your harvest in the marketplace send their
          price offers here. Accepting one marks that harvest sold and declines
          every other offer standing on it.
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
          aria-label="Reload offers"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <section className="grid gap-4">
        {offers.map((offer) => {
          const status = RECEIVED_STATUS_META[offer.status];
          const busy = busyId === offer.id;
          const error = rowErrors[offer.id];
          const delta = offerDelta(offer);

          return (
            <article
              key={offer.id}
              className={`surface-card p-5 transition-opacity sm:p-6 ${
                busy ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-leaf-strong">
                    {offer.factory}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" />{" "}
                      {offer.listing?.district ??
                        offer.factoryDistrict ??
                        "District not set"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />{" "}
                      {offer.weightKg.toLocaleString()} kg
                    </span>
                    {offer.listing ? (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />{" "}
                        {formatHarvestAge(offer.listing.harvestDate)}
                      </span>
                    ) : null}
                    {offer.factoryPhone ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="size-3.5" /> {offer.factoryPhone}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-leaf-strong">
                    {formatRupees(offer.pricePerKg)}
                    <span className="text-sm font-medium text-muted-foreground">
                      /kg
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRupees(offer.totalValue)} for the lot
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      delta >= 0 ? "text-leaf-strong" : "text-amber-700"
                    }`}
                  >
                    {formatOfferDelta(offer)}
                  </p>
                </div>
              </div>

              {offer.message && (
                <p className="mt-4 rounded-xl bg-secondary p-3 text-sm leading-relaxed text-muted-foreground">
                  {offer.message}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {offer.status === "pending" ? (
                  <>
                    <Button
                      variant="hero"
                      size="lg"
                      disabled={busy}
                      onClick={() => void decide(offer, "accepted")}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Accept offer
                    </Button>
                    <Button
                      variant="leafOutline"
                      size="lg"
                      disabled={busy}
                      onClick={() => void decide(offer, "declined")}
                    >
                      <X className="size-4" /> Decline
                    </Button>
                  </>
                ) : (
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${status.className}`}
                  >
                    {offer.status === "accepted" ? (
                      <Check className="size-4" />
                    ) : (
                      <X className="size-4" />
                    )}
                    {status.label}
                  </span>
                )}

                {/* Names the offer rather than a thread: the chat page finds
                    the conversation with this mill, or opens one. */}
                <Button asChild variant="ghost" size="lg">
                  <Link href={chatHrefForOffer(offer.id)}>
                    <MessageCircle className="size-4" /> Chat with{" "}
                    {offer.factory}
                  </Link>
                </Button>
              </div>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
            </article>
          );
        })}

        {!loading && offers.length === 0 && !loadError ? (
          <div className="surface-card grid place-items-center gap-2 p-10 text-center">
            <Tag className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              {filter === "all"
                ? "No offers yet. Publish a harvest listing and factories browsing the marketplace can send you a price straight away."
                : "No offers in this state right now."}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default OffersPage;
