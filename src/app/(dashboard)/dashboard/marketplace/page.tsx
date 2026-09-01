"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  CircleX,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chatHrefForListing } from "@/lib/chat";
import { formatRupees } from "@/lib/listings";
import {
  ALL_DISTRICTS,
  EMPTY_FILTERS,
  OFFER_STATUS_META,
  formatHarvestAge,
  marketQueryString,
  validateOfferPrice,
  type CreateOfferResponse,
  type MarketFilters,
  type MarketListing,
  type MarketOffer,
  type MarketplaceResponse,
  type WithdrawOfferResponse,
} from "@/lib/marketplace";

/**
 * Browse Harvest Marketplace.
 *
 * Everything here comes from `/api/marketplace`: the farmers' open listings,
 * the districts behind the filter, and this mill's own standing offers. The
 * filters are query parameters rather than a pass over an array in the
 * browser, so the feed stays correct once there is more stock than one
 * response carries.
 */

const GENERIC_ERROR = "The marketplace could not be loaded right now.";

/** How long the filter boxes settle before the feed is asked again. */
const FILTER_DEBOUNCE_MS = 300;

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestMarketplace(
  filters: MarketFilters,
): Promise<MarketplaceResponse> {
  const response = await fetch(
    `/api/marketplace${marketQueryString(filters)}`,
    {
      cache: "no-store",
    },
  );

  return (await response.json()) as MarketplaceResponse;
}

const MarketPage = () => {
  const [filters, setFilters] = useState<MarketFilters>(EMPTY_FILTERS);

  const [listings, setListings] = useState<MarketListing[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [offers, setOffers] = useState<MarketOffer[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Draft offer price per listing, keyed by listing id. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Id of the card mid-request, so only that card shows as busy. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  /** Bumped by the reload button so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Typing in a filter box should not fire a request per keystroke, so the
    // spinner starts with the request rather than with the keystroke.
    const timer = setTimeout(() => {
      setLoading(true);

      requestMarketplace(filters)
        .then((payload) => {
          if (cancelled) return;

          if (payload.ok) {
            setListings(payload.items);
            setDistricts(payload.districts);
            setOffers(payload.offers);
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
    }, FILTER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const setFilter = useCallback((key: keyof MarketFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  /** Offers are looked up per card, so index them once per render. */
  const offersByListing = useMemo(
    () => new Map(offers.map((offer) => [offer.listingId, offer])),
    [offers],
  );

  const makeOffer = async (listing: MarketListing) => {
    const typed = drafts[listing.id];
    const price = validateOfferPrice(
      typed === undefined || typed.trim() === "" ? listing.pricePerKg : typed,
    );

    if (!price.ok) {
      setOfferErrors((current) => ({ ...current, [listing.id]: price.error }));
      return;
    }

    setBusyId(listing.id);
    setOfferErrors((current) => {
      const next = { ...current };
      delete next[listing.id];
      return next;
    });

    try {
      const response = await fetch("/api/marketplace/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          pricePerKg: price.value,
        }),
      });

      const payload = (await response.json()) as CreateOfferResponse;

      if (payload.ok) {
        setOffers((current) => [
          payload.offer,
          ...current.filter((offer) => offer.listingId !== listing.id),
        ]);
        setDrafts((current) => ({ ...current, [listing.id]: "" }));
      } else {
        setOfferErrors((current) => ({
          ...current,
          [listing.id]: payload.error,
        }));

        // A listing the farmer has since sold or withdrawn is stale on screen;
        // pull the feed again so it stops being offerable.
        if (response.status === 404 || response.status === 409) reload();
      }
    } catch {
      setOfferErrors((current) => ({
        ...current,
        [listing.id]: "Could not reach the CeylonGuard server.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  const withdrawOffer = async (listingId: string) => {
    setBusyId(listingId);

    try {
      const response = await fetch(
        `/api/marketplace/offers?listingId=${listingId}`,
        { method: "DELETE" },
      );

      const payload = (await response.json()) as WithdrawOfferResponse;

      if (payload.ok) {
        setOffers((current) =>
          current.filter((offer) => offer.listingId !== listingId),
        );
      } else {
        setOfferErrors((current) => ({
          ...current,
          [listingId]: payload.error,
        }));
      }
    } catch {
      setOfferErrors((current) => ({
        ...current,
        [listingId]: "Could not reach the CeylonGuard server.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Store className="size-3.5" /> Factory Portal · Marketplace
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Harvest Discovery Feed
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every harvest farmers have published, newest first. Filter by
          district, price and quantity, then send a direct price offer in one
          action. Listings carrying the AI Disease Free Stamp are marked
          verified.
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

      <section className="surface-card grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              className="h-12 pl-9"
              placeholder="Farmer or district"
              value={filters.query}
              onChange={(event) => setFilter("query", event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>District</Label>
          <Select
            value={filters.district}
            onValueChange={(value) =>
              setFilter("district", value ?? ALL_DISTRICTS)
            }
          >
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_DISTRICTS}>All districts</SelectItem>
              {districts.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filterPrice">Max price / kg</Label>
          <Input
            id="filterPrice"
            type="number"
            min={1}
            className="h-12"
            placeholder="Any"
            value={filters.maxPrice}
            onChange={(event) => setFilter("maxPrice", event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filterQty">Min quantity (kg)</Label>
          <Input
            id="filterQty"
            type="number"
            min={1}
            className="h-12"
            placeholder="Any"
            value={filters.minQty}
            onChange={(event) => setFilter("minQty", event.target.value)}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading listings…"
            : `${listings.length} ${
                listings.length === 1 ? "listing" : "listings"
              } match these filters`}
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={loading}
          aria-label="Reload listings"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <section className="grid gap-4">
        {listings.map((listing) => {
          const sent = offersByListing.get(listing.id);
          const status = sent ? OFFER_STATUS_META[sent.status] : null;
          const busy = busyId === listing.id;
          const error = offerErrors[listing.id];

          return (
            <article
              key={listing.id}
              className={`surface-card p-5 transition-opacity sm:p-6 ${
                busy ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-leaf-strong">
                    {listing.farmer}
                    {listing.verification ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-leaf-soft px-2 py-0.5 text-[11px] font-semibold text-leaf-strong">
                        <ShieldCheck className="size-3" /> Verified ·{" "}
                        {listing.verification.confidence.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        No leaf scan
                      </span>
                    )}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {listing.district}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />{" "}
                      {listing.weightKg.toLocaleString()} kg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />{" "}
                      {listing.harvestDate} ·{" "}
                      {formatHarvestAge(listing.harvestDate)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-leaf-strong">
                    {formatRupees(listing.pricePerKg)}
                    <span className="text-sm font-medium text-muted-foreground">
                      /kg
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRupees(listing.totalValue)} for the lot
                  </p>
                </div>
              </div>

              <form
                className="mt-5 flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void makeOffer(listing);
                }}
              >
                <div className="grid gap-2">
                  <Label htmlFor={`offer-${listing.id}`}>
                    Your offer (Rs./kg)
                  </Label>
                  <Input
                    id={`offer-${listing.id}`}
                    type="number"
                    min={1}
                    className="h-12 w-40"
                    placeholder={String(listing.pricePerKg)}
                    aria-invalid={Boolean(error)}
                    value={drafts[listing.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [listing.id]: event.target.value,
                      }))
                    }
                  />
                </div>

                <Button type="submit" variant="hero" size="lg" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {sent ? "Update offer" : "Make offer"}
                </Button>

                {/* Names the harvest rather than a thread: the chat page finds
                    the conversation with this farmer, or opens one. */}
                <Button asChild variant="ghost" size="lg">
                  <Link href={chatHrefForListing(listing.id)}>
                    <MessageCircle className="size-4" /> Chat with{" "}
                    {listing.farmer}
                  </Link>
                </Button>

                {sent && status ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                    >
                      <Check className="size-3.5" /> {status.label} at{" "}
                      {formatRupees(sent.pricePerKg)}/kg
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void withdrawOffer(listing.id)}
                    >
                      Withdraw
                    </Button>
                  </div>
                ) : null}
              </form>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
            </article>
          );
        })}

        {!loading && listings.length === 0 && !loadError ? (
          <div className="surface-card grid place-items-center gap-2 p-10 text-center">
            <Store className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No listings match these filters. Try widening the price or
              quantity range — new harvests appear here as soon as farmers
              publish them.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default MarketPage;
