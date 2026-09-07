import { toDayString } from "@/lib/listings";
import type { MarketListing, MarketOffer } from "@/lib/marketplace";

/**
 * Mock data behind the factory dashboard.
 *
 * The screen is display-only for now — nothing here touches Mongo. Listings
 * and offers follow the real marketplace contracts (`MarketListing`,
 * `MarketOffer`), so pointing the dashboard at `/api/marketplace` later is a
 * change of source, not of markup. Orders now have one — `/api/orders`, which
 * the order tracking page reads — so `FactoryOrder` is the last row here still
 * waiting to be swapped for its real contract, `OrderItem` in `@/lib/orders`.
 *
 * Every date is relative to today, so the dashboard never reads as stale.
 */

/** Calendar day (`YYYY-MM-DD`) `days` days back from today. */
function day(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return toDayString(date);
}

/** ISO timestamp for `hour` o'clock, `days` days back from today. */
function at(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);

  return date.toISOString();
}

/**
 * A market listing plus the seller's standing.
 *
 * Trust is held by the profile service rather than the listing, so the feed
 * will join it in; until then it rides along on the mock row.
 */
export type FactoryListing = MarketListing & {
  /** The farmer's standing out of 100. */
  trustScore: number;
};

export type OrderStatus = "Confirmed" | "In Transit" | "Delivered";

/** A confirmed purchase, as the dashboard and the orders page read it. */
export type FactoryOrder = {
  id: string;
  farmer: string;
  district: string;
  weightKg: number;
  pricePerKg: number;
  /** Calendar day as `YYYY-MM-DD`, so the newest rows sort first. */
  placedOn: string;
  status: OrderStatus;
};

/** Builds a listing row, filling in the total the server would compute. */
function listing(
  row: Omit<FactoryListing, "totalValue">,
): FactoryListing {
  return { ...row, totalValue: row.weightKg * row.pricePerKg };
}

export const MOCK_FACTORY_LISTINGS: FactoryListing[] = [
  listing({
    id: "lst-4101",
    farmer: "Sunil Rathnayake",
    farmerDistrict: "Nuwara Eliya",
    weightKg: 480,
    pricePerKg: 285,
    district: "Nuwara Eliya",
    harvestDate: day(1),
    createdAt: at(1, 8),
    trustScore: 94,
  }),
  listing({
    id: "lst-4098",
    farmer: "Kamala Wijesinghe",
    farmerDistrict: "Kandy",
    weightKg: 320,
    pricePerKg: 262,
    district: "Kandy",
    harvestDate: day(2),
    createdAt: at(2, 10),
    trustScore: 88,
  }),
  listing({
    id: "lst-4092",
    farmer: "Nimal Perera",
    farmerDistrict: "Badulla",
    weightKg: 750,
    pricePerKg: 240,
    district: "Badulla",
    harvestDate: day(3),
    createdAt: at(3, 7),
    trustScore: 91,
  }),
  listing({
    id: "lst-4085",
    farmer: "Anoma Gunasekara",
    farmerDistrict: "Ratnapura",
    weightKg: 210,
    pricePerKg: 298,
    district: "Ratnapura",
    harvestDate: day(4),
    createdAt: at(4, 9),
    trustScore: 79,
  }),
  listing({
    id: "lst-4077",
    farmer: "Jagath Bandara",
    farmerDistrict: "Matara",
    weightKg: 540,
    pricePerKg: 231,
    district: "Galle",
    harvestDate: day(5),
    createdAt: at(5, 11),
    trustScore: 86,
  }),
  listing({
    id: "lst-4070",
    farmer: "Rohana Silva",
    farmerDistrict: "Kegalle",
    weightKg: 380,
    pricePerKg: 255,
    district: "Kegalle",
    harvestDate: day(6),
    createdAt: at(6, 8),
    trustScore: 83,
  }),
];

export const MOCK_FACTORY_OFFERS: MarketOffer[] = [
  {
    id: "ofr-8821",
    listingId: "lst-4101",
    pricePerKg: 279,
    status: "pending",
    createdAt: at(0, 9),
  },
  {
    id: "ofr-8814",
    listingId: "lst-4098",
    pricePerKg: 258,
    status: "pending",
    createdAt: at(1, 14),
  },
  {
    id: "ofr-8802",
    listingId: "lst-4092",
    pricePerKg: 238,
    status: "accepted",
    createdAt: at(3, 10),
  },
  {
    id: "ofr-8790",
    listingId: "lst-4085",
    pricePerKg: 271,
    status: "declined",
    createdAt: at(4, 16),
  },
  {
    id: "ofr-8783",
    listingId: "lst-4077",
    pricePerKg: 228,
    status: "withdrawn",
    createdAt: at(5, 12),
  },
];

export const MOCK_FACTORY_ORDERS: FactoryOrder[] = [
  {
    id: "ord-1",
    farmer: "Sunil Rathnayake",
    district: "Nuwara Eliya",
    weightKg: 480,
    pricePerKg: 285,
    placedOn: day(0),
    status: "Confirmed",
  },
  {
    id: "ord-2",
    farmer: "Kamala Wijesinghe",
    district: "Kandy",
    weightKg: 320,
    pricePerKg: 262,
    placedOn: day(2),
    status: "In Transit",
  },
  {
    id: "ord-3",
    farmer: "Anoma Gunasekara",
    district: "Ratnapura",
    weightKg: 210,
    pricePerKg: 298,
    placedOn: day(4),
    status: "In Transit",
  },
  {
    id: "ord-4",
    farmer: "Nimal Perera",
    district: "Badulla",
    weightKg: 750,
    pricePerKg: 240,
    placedOn: day(7),
    status: "Delivered",
  },
  {
    id: "ord-5",
    farmer: "Rohana Silva",
    district: "Kegalle",
    weightKg: 380,
    pricePerKg: 255,
    placedOn: day(11),
    status: "Delivered",
  },
];
