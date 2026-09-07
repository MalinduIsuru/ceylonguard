import type { ListingStatus } from "@/lib/models/Listing";
import type { OfferStatus } from "@/lib/models/Offer";

/**
 * Shared contract between /api/offers and the farmer's "Offers Received" page.
 *
 * The factory sends through `@/lib/marketplace`; this is the same rows read
 * from the other side of the trade. Where `MarketOffer` is the thin record a
 * buyer needs to see its own standing bid, a `ReceivedOffer` carries what the
 * seller has to weigh a decision on: who is bidding, what the harvest was
 * advertised at, and what the offer is worth for the whole lot.
 */

export type { OfferStatus };

/** The harvest an offer is against, as it stands today. */
export type OfferListing = {
  id: string;
  district: string;
  /** Calendar day as `YYYY-MM-DD`. */
  harvestDate: string;
  status: ListingStatus;
};

export type ReceivedOffer = {
  id: string;
  /** Mill name as onboarded, or a neutral fallback for a thin profile. */
  factory: string;
  factoryDistrict?: string;
  factoryPhone?: string;

  /** Rupees per kilogram the factory is willing to pay. */
  pricePerKg: number;
  /** The listing's asking price when the offer was made. */
  askingPricePerKg: number;
  /** The listing's weight when the offer was made. */
  weightKg: number;
  /** `weightKg * pricePerKg`, computed once on the server. */
  totalValue: number;

  message?: string;
  status: OfferStatus;

  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 — when the offer was last re-priced or decided. */
  updatedAt: string;

  /**
   * The harvest behind the offer, absent once the farmer has deleted it. The
   * offer still reads correctly without it: weight and asking price are frozen
   * on the offer itself.
   */
  listing?: OfferListing;
};

/** Totals across the offers a farmer has received. */
export type OfferStats = {
  pending: number;
  accepted: number;
  declined: number;
  /** Highest price among pending offers, 0 when none are pending. */
  bestPricePerKg: number;
  /** Rupees on the table across every pending offer. */
  pendingValue: number;
};

export type OffersSuccess = {
  ok: true;
  /** Offers matching the filter, newest first. */
  items: ReceivedOffer[];
  /** Totals over every offer, filter or not. */
  stats: OfferStats;
};

export type OfferFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type OffersResponse = OffersSuccess | OfferFailure;

export type DecideOfferSuccess = {
  ok: true;
  /** The offer as it now stands. */
  offer: ReceivedOffer;
  /** True when accepting also marked the harvest sold. */
  listingSold: boolean;
  /** How many rival offers accepting this one declined. */
  declined: number;
};

export type DecideOfferResponse = DecideOfferSuccess | OfferFailure;

/** The only two moves a seller has on a pending offer. */
export type OfferDecision = Extract<OfferStatus, "accepted" | "declined">;

export const OFFER_DECISIONS: OfferDecision[] = ["accepted", "declined"];

export function isOfferDecision(value: unknown): value is OfferDecision {
  return (
    typeof value === "string" && OFFER_DECISIONS.includes(value as OfferDecision)
  );
}

/** Which slice of the inbox to read. "all" hides offers the mill pulled. */
export type OfferFilter = "all" | OfferStatus;

export const OFFER_FILTERS: OfferFilter[] = [
  "all",
  "pending",
  "accepted",
  "declined",
  "withdrawn",
];

export function isOfferFilter(value: unknown): value is OfferFilter {
  return typeof value === "string" && OFFER_FILTERS.includes(value as OfferFilter);
}

export const OFFERS_PAGE_SIZE = 30;
export const OFFERS_MAX_PAGE_SIZE = 100;

/** Filter to a query string; an untouched inbox asks for the plain feed. */
export function offersQueryString(filter: OfferFilter): string {
  return filter === "all" ? "" : `?status=${filter}`;
}

/** How the seller reads each status, which is not how the buyer reads it. */
export const RECEIVED_STATUS_META: Record<
  OfferStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Awaiting your decision",
    className: "bg-amber-50 text-amber-800",
  },
  accepted: {
    label: "Offer accepted",
    className: "bg-leaf-soft text-leaf-strong",
  },
  declined: {
    label: "Offer declined",
    className: "bg-secondary text-muted-foreground",
  },
  withdrawn: {
    label: "Withdrawn by factory",
    className: "bg-secondary text-muted-foreground",
  },
};

/** Rupees per kilogram above (positive) or below the asking price. */
export function offerDelta(offer: ReceivedOffer): number {
  return offer.pricePerKg - offer.askingPricePerKg;
}

/**
 * The offer against what the farmer asked for — the one comparison that
 * decides most of these, so it is phrased rather than left as arithmetic.
 */
export function formatOfferDelta(offer: ReceivedOffer): string {
  const delta = offerDelta(offer);

  if (delta === 0) return "Matches your asking price";

  const share = Math.abs(delta / offer.askingPricePerKg) * 100;
  const size = `Rs. ${Math.abs(delta).toLocaleString("en-LK")}/kg (${share.toFixed(0)}%)`;

  return delta > 0 ? `${size} above asking` : `${size} below asking`;
}
