import { STAMP_VALID_DAYS, toDayString, type ListingItem } from "@/lib/listings";
import type { ReceivedOffer } from "@/lib/offers";

/**
 * Mock data behind the farmer dashboard.
 *
 * The dashboard is display-only for now — nothing here touches Mongo or the ML
 * service. The rows follow the real API contracts (`ListingItem`,
 * `ReceivedOffer`), so wiring the page to `/api/listings` and `/api/offers`
 * later is a change of source, not of markup.
 */

/** One row in "Recent scans" — the slice of a scan the dashboard shows. */
export type DashboardScan = {
  id: string;
  /** Human-facing disease name, e.g. "Healthy" or "Grey Blight". */
  label: string;
  isHealthy: boolean;
  /** Percentage, 0 to 100. */
  confidence: number;
  /** ISO 8601. */
  scannedAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp for `hour` o'clock, `days` days back from today. */
function at(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);

  return date.toISOString();
}

/** Calendar day (`YYYY-MM-DD`) `days` days back from today. */
function day(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return toDayString(date);
}

export const MOCK_FARMER_NAME = "K. Perera";

/** Farmer's standing out of 100, as the profile service will report it. */
export const MOCK_TRUST_SCORE = 88;

export const MOCK_SCANS: DashboardScan[] = [
  {
    id: "scn_2417",
    label: "Healthy",
    isHealthy: true,
    confidence: 97.4,
    scannedAt: at(1, 7),
  },
  {
    id: "scn_2411",
    label: "Grey Blight",
    isHealthy: false,
    confidence: 91.2,
    scannedAt: at(3, 16),
  },
  {
    id: "scn_2404",
    label: "Healthy",
    isHealthy: true,
    confidence: 95.8,
    scannedAt: at(6, 8),
  },
  {
    id: "scn_2390",
    label: "Red Leaf Spot",
    isHealthy: false,
    confidence: 88.6,
    scannedAt: at(11, 10),
  },
  {
    id: "scn_2377",
    label: "Healthy",
    isHealthy: true,
    confidence: 93.1,
    scannedAt: at(15, 9),
  },
];

export const MOCK_LISTINGS: ListingItem[] = [
  {
    id: "lst_1041",
    weightKg: 320,
    pricePerKg: 145,
    totalValue: 46_400,
    district: "Nuwara Eliya",
    harvestDate: day(1),
    status: "active",
    verification: {
      label: "Healthy",
      confidence: 97.4,
      scannedAt: at(1, 7),
    },
    createdAt: at(1, 8),
  },
  {
    id: "lst_1038",
    weightKg: 180,
    pricePerKg: 138,
    totalValue: 24_840,
    district: "Kandy",
    harvestDate: day(3),
    status: "active",
    createdAt: at(3, 10),
  },
  {
    id: "lst_1029",
    weightKg: 260,
    pricePerKg: 152,
    totalValue: 39_520,
    district: "Nuwara Eliya",
    harvestDate: day(9),
    status: "sold",
    verification: {
      label: "Healthy",
      confidence: 96.0,
      scannedAt: at(9, 7),
    },
    createdAt: at(9, 9),
  },
];

export const MOCK_OFFERS: ReceivedOffer[] = [
  {
    id: "ofr_5521",
    factory: "Mackwoods Tea Factory",
    factoryDistrict: "Nuwara Eliya",
    factoryPhone: "+94 77 412 6690",
    pricePerKg: 152,
    askingPricePerKg: 145,
    weightKg: 320,
    totalValue: 48_640,
    message: "Above your asking price if you can deliver before Friday.",
    status: "pending",
    createdAt: at(0, 7),
    updatedAt: at(0, 7),
    listing: {
      id: "lst_1041",
      district: "Nuwara Eliya",
      harvestDate: day(1),
      status: "active",
      verified: true,
    },
  },
  {
    id: "ofr_5518",
    factory: "Damro Tea (Pvt) Ltd",
    factoryDistrict: "Kandy",
    pricePerKg: 141,
    askingPricePerKg: 145,
    weightKg: 320,
    totalValue: 45_120,
    status: "pending",
    createdAt: at(1, 16),
    updatedAt: at(1, 16),
    listing: {
      id: "lst_1041",
      district: "Nuwara Eliya",
      harvestDate: day(1),
      status: "active",
      verified: true,
    },
  },
  {
    id: "ofr_5502",
    factory: "Kandy Highlands Tea",
    factoryDistrict: "Kandy",
    pricePerKg: 155,
    askingPricePerKg: 152,
    weightKg: 260,
    totalValue: 40_300,
    status: "accepted",
    createdAt: at(9, 11),
    updatedAt: at(8, 9),
    listing: {
      id: "lst_1029",
      district: "Nuwara Eliya",
      harvestDate: day(9),
      status: "sold",
      verified: true,
    },
  },
  {
    id: "ofr_5496",
    factory: "Ceylon Fresh Leaf Co.",
    factoryDistrict: "Matale",
    pricePerKg: 120,
    askingPricePerKg: 138,
    weightKg: 180,
    totalValue: 21_600,
    status: "declined",
    createdAt: at(4, 13),
    updatedAt: at(3, 15),
    listing: {
      id: "lst_1038",
      district: "Kandy",
      harvestDate: day(3),
      status: "active",
      verified: false,
    },
  },
];

/**
 * The scan that unlocks a listing: the newest healthy one still inside
 * `STAMP_VALID_DAYS`. Null renders the locked state instead.
 */
export const MOCK_VERIFIED_SCAN: DashboardScan | null =
  MOCK_SCANS.find(
    (scan) =>
      scan.isHealthy &&
      Date.now() - new Date(scan.scannedAt).getTime() <
        STAMP_VALID_DAYS * DAY_MS,
  ) ?? null;
