import type { ListingStatus } from "@/lib/models/Listing";

/** Shared contract between /api/listings and the marketplace UI. */

export type { ListingStatus };

/** The AI Disease Free Stamp as the UI reads it back. */
export type ListingVerificationView = {
  label: string;
  /** Percentage, 0 to 100. */
  confidence: number;
  /** ISO 8601. */
  scannedAt: string;
  imageUrl?: string;
};

export type ListingItem = {
  id: string;
  weightKg: number;
  pricePerKg: number;
  /** `weightKg * pricePerKg`, computed once on the server. */
  totalValue: number;
  district: string;
  /** Calendar day as `YYYY-MM-DD` — a harvest date has no time of day. */
  harvestDate: string;
  status: ListingStatus;
  /** Present only when the listing carries the stamp. */
  verification?: ListingVerificationView;
  /** ISO 8601. */
  createdAt: string;
};

/**
 * A healthy scan the farmer has not spent yet, offered as the stamp for the
 * next listing. Null when the farmer has no recent healthy scan available.
 */
export type AvailableStamp = {
  scanId: string;
  label: string;
  confidence: number;
  scannedAt: string;
  imageUrl?: string;
};

/** Totals across every listing the farmer has published. */
export type ListingStats = {
  active: number;
  verified: number;
  totalWeightKg: number;
  /** Weighted by nothing — a plain mean over active listings, 0 when none. */
  averagePricePerKg: number;
};

export type ListingsSuccess = {
  ok: true;
  items: ListingItem[];
  stats: ListingStats;
  stamp: AvailableStamp | null;
};

export type ListingFailure = {
  ok: false;
  error: string;
  hint?: string;
  /** Per-field messages, set when the form itself was the problem. */
  fieldErrors?: ListingFieldErrors;
};

export type ListingsResponse = ListingsSuccess | ListingFailure;

export type CreateListingSuccess = {
  ok: true;
  listing: ListingItem;
  /** False when the listing published without a stamp. */
  verified: boolean;
};

export type CreateListingResponse = CreateListingSuccess | ListingFailure;

export type UpdateListingSuccess = {
  ok: true;
  listing: ListingItem;
};

export type UpdateListingResponse = UpdateListingSuccess | ListingFailure;

export type DeleteListingSuccess = {
  ok: true;
  id: string;
};

export type DeleteListingResponse = DeleteListingSuccess | ListingFailure;

/** What the publish form sends. Values arrive as typed by the farmer. */
export type CreateListingInput = {
  weightKg: unknown;
  pricePerKg: unknown;
  district: unknown;
  harvestDate: unknown;
  /**
   * Whether to spend the offered stamp on this listing. The client never picks
   * the scan id — the server resolves it, so a farmer cannot attach someone
   * else's scan or one they have already used.
   */
  useStamp?: boolean;
};

export type ListingField =
  | "weightKg"
  | "pricePerKg"
  | "district"
  | "harvestDate";

export type ListingFieldErrors = Partial<Record<ListingField, string>>;

/** A validated listing, ready to write. */
export type NormalisedListing = {
  weightKg: number;
  pricePerKg: number;
  district: string;
  /** `YYYY-MM-DD`. */
  harvestDate: string;
  /** The same day at UTC midnight, ready to write. */
  harvestDay: Date;
};

export const LISTING_LIMITS = {
  /** A single smallholder delivery; anything larger is a data-entry slip. */
  maxWeightKg: 50_000,
  maxPricePerKg: 100_000,
  /** Green leaf does not keep, so a listing cannot be back-dated further. */
  maxHarvestAgeDays: 30,
} as const;

/**
 * How long a healthy scan can still stamp a listing.
 *
 * The stamp is a claim about the leaf being sold now, so an old scan stops
 * counting rather than verifying every future harvest from the same block.
 */
export const STAMP_VALID_DAYS = 7;

/** Page size for "My listings". */
export const LISTINGS_PAGE_SIZE = 20;

/** `YYYY-MM-DD` for a date, read in UTC so the calendar day never shifts. */
export function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today as `YYYY-MM-DD`, used as the form's max harvest date. */
export function todayString(): string {
  return toDayString(new Date());
}

/** Parses `YYYY-MM-DD` to UTC midnight. Null when the shape is wrong. */
export function parseDayString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) return null;

  // Rejects real-looking but impossible days such as 2026-02-31.
  return toDayString(parsed) === value ? parsed : null;
}

function readPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

/**
 * Validates a publish form.
 *
 * Runs on both sides: the page uses it to show field errors without a round
 * trip, and the route runs it again because a client check is not a guarantee.
 */
export function validateListingInput(
  input: CreateListingInput,
): { ok: true; value: NormalisedListing } | { ok: false; errors: ListingFieldErrors } {
  const errors: ListingFieldErrors = {};

  const weightKg = readPositiveNumber(input.weightKg);

  if (weightKg === null) {
    errors.weightKg = "Enter the total weight in kilograms.";
  } else if (weightKg > LISTING_LIMITS.maxWeightKg) {
    errors.weightKg = `Weight cannot be more than ${LISTING_LIMITS.maxWeightKg.toLocaleString()} kg.`;
  }

  const pricePerKg = readPositiveNumber(input.pricePerKg);

  if (pricePerKg === null) {
    errors.pricePerKg = "Enter your asking price per kilogram.";
  } else if (pricePerKg > LISTING_LIMITS.maxPricePerKg) {
    errors.pricePerKg = `Price cannot be more than Rs. ${LISTING_LIMITS.maxPricePerKg.toLocaleString()}/kg.`;
  }

  const district = typeof input.district === "string" ? input.district.trim() : "";

  if (district.length < 2) {
    errors.district = "Enter the district the harvest comes from.";
  } else if (district.length > 64) {
    errors.district = "That district name is too long.";
  }

  const rawDate = typeof input.harvestDate === "string" ? input.harvestDate.trim() : "";
  const harvestDay = parseDayString(rawDate);

  if (!harvestDay) {
    errors.harvestDate = "Pick the date the leaf was picked.";
  } else {
    const today = new Date(`${todayString()}T00:00:00.000Z`);
    const ageDays = Math.round(
      (today.getTime() - harvestDay.getTime()) / 86_400_000,
    );

    if (ageDays < 0) {
      errors.harvestDate = "The harvest date cannot be in the future.";
    } else if (ageDays > LISTING_LIMITS.maxHarvestAgeDays) {
      errors.harvestDate = `Harvests older than ${LISTING_LIMITS.maxHarvestAgeDays} days cannot be listed.`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      weightKg: Math.round(weightKg!),
      pricePerKg: Math.round(pricePerKg!),
      district,
      harvestDate: rawDate,
      harvestDay: harvestDay!,
    },
  };
}

/** "Rs. 32,500" — listings are priced in whole rupees. */
export function formatRupees(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString("en-LK")}`;
}

export const STATUS_META: Record<
  ListingStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-leaf-soft text-leaf-strong",
  },
  sold: {
    label: "Sold",
    className: "bg-secondary text-muted-foreground",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-secondary text-muted-foreground",
  },
};
