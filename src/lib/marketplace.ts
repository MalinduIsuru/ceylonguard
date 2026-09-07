import type { OfferStatus } from "@/lib/models/Offer";

/**
 * Shared contract between /api/marketplace and the factory-side browse page.
 *
 * The farmer publishes through `@/lib/listings`; this is the same rows read
 * from the other side of the trade, so the view types deliberately mirror
 * `ListingItem` and add only what a buyer needs — who is selling, and whether
 * this mill has already bid.
 */

export type { OfferStatus };

export type MarketListing = {
  id: string;
  /** Seller's display name, or a neutral fallback when the profile is thin. */
  farmer: string;
  /** The seller's home district, which can differ from the harvest's. */
  farmerDistrict?: string;

  weightKg: number;
  pricePerKg: number;
  /** `weightKg * pricePerKg`, computed once on the server. */
  totalValue: number;
  district: string;
  /** Calendar day as `YYYY-MM-DD`. */
  harvestDate: string;

  /** ISO 8601. */
  createdAt: string;
};

/** An offer this factory has sent, as the browse page reads it back. */
export type MarketOffer = {
  id: string;
  listingId: string;
  pricePerKg: number;
  status: OfferStatus;
  /** ISO 8601. */
  createdAt: string;
};

export type MarketplaceSuccess = {
  ok: true;
  /** Listings matching the filters, newest first. */
  items: MarketListing[];
  /** Every district with open stock, so the filter never collapses. */
  districts: string[];
  /** This factory's standing offers, filters or not. */
  offers: MarketOffer[];
};

export type MarketplaceFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type MarketplaceResponse = MarketplaceSuccess | MarketplaceFailure;

export type CreateOfferSuccess = {
  ok: true;
  offer: MarketOffer;
  /** False when the offer replaced one this factory had already sent. */
  created: boolean;
};

export type CreateOfferResponse = CreateOfferSuccess | MarketplaceFailure;

export type WithdrawOfferSuccess = {
  ok: true;
  /** The offer as it now stands: withdrawn, not gone. */
  offer: MarketOffer;
};

export type WithdrawOfferResponse = WithdrawOfferSuccess | MarketplaceFailure;

/** What the offer form sends. The price arrives as typed by the buyer. */
export type CreateOfferInput = {
  listingId: string;
  pricePerKg: unknown;
  message?: string;
};

export const MARKET_LIMITS = {
  maxPricePerKg: 100_000,
  maxMessageLength: 300,
  /** Filters are cheap; reading past this means it is time for paging. */
  pageSize: 40,
  maxPageSize: 100,
} as const;

export const ALL_DISTRICTS = "all";

/** The browse filters, held as typed so an empty box means "no filter". */
export type MarketFilters = {
  query: string;
  district: string;
  maxPrice: string;
  minQty: string;
};

export const EMPTY_FILTERS: MarketFilters = {
  query: "",
  district: ALL_DISTRICTS,
  maxPrice: "",
  minQty: "",
};

/**
 * Filters to a query string.
 *
 * Only meaningful values are sent, so an untouched form asks for the plain
 * feed and the request URL stays readable in the network tab.
 */
export function marketQueryString(filters: MarketFilters): string {
  const params = new URLSearchParams();

  const query = filters.query.trim();
  if (query) params.set("q", query);

  if (filters.district && filters.district !== ALL_DISTRICTS) {
    params.set("district", filters.district);
  }

  const maxPrice = Number(filters.maxPrice);
  if (filters.maxPrice.trim() !== "" && Number.isFinite(maxPrice) && maxPrice > 0) {
    params.set("maxPrice", String(maxPrice));
  }

  const minQty = Number(filters.minQty);
  if (filters.minQty.trim() !== "" && Number.isFinite(minQty) && minQty > 0) {
    params.set("minQty", String(minQty));
  }

  const search = params.toString();

  return search ? `?${search}` : "";
}

/**
 * Validates an offer price.
 *
 * Runs on both sides: the card uses it to reject a nonsense bid without a
 * round trip, and the route runs it again because a client check is not a
 * guarantee.
 */
export function validateOfferPrice(
  value: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: "Enter the price you want to pay per kilogram." };
  }

  if (parsed > MARKET_LIMITS.maxPricePerKg) {
    return {
      ok: false,
      error: `An offer cannot be more than Rs. ${MARKET_LIMITS.maxPricePerKg.toLocaleString()}/kg.`,
    };
  }

  return { ok: true, value: Math.round(parsed) };
}

export const OFFER_STATUS_META: Record<
  OfferStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Offer sent",
    className: "bg-leaf-soft text-leaf-strong",
  },
  accepted: {
    label: "Accepted",
    className: "bg-leaf-soft text-leaf-strong",
  },
  declined: {
    label: "Declined",
    className: "bg-secondary text-muted-foreground",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-secondary text-muted-foreground",
  },
};

/** "3 days ago" for a harvest date, which is how buyers judge freshness. */
export function daysSince(day: string): number {
  const picked = new Date(`${day}T00:00:00.000Z`).getTime();

  if (Number.isNaN(picked)) return 0;

  const today = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
  ).getTime();

  return Math.max(0, Math.round((today - picked) / 86_400_000));
}

export function formatHarvestAge(day: string): string {
  const days = daysSince(day);

  if (days === 0) return "picked today";
  if (days === 1) return "picked yesterday";

  return `picked ${days} days ago`;
}
