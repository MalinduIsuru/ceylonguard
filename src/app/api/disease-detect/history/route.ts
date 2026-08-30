import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  HISTORY_PAGE_SIZE,
  type HistoryStats,
  type HistorySuccess,
  type ScanFailure,
  type ScanHistoryItem,
} from "@/lib/disease-detect";
import connectDB from "@/lib/mongodb";
import Scan, { type IScan } from "@/lib/models/Scan";

/**
 * Scan history for the signed-in farmer, newest first.
 *
 * Rows are returned whole — including the treatment plan captured at scan time
 * — so the history tab can reopen an old result without a second request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reading past this depth means it is time for search, not more paging. */
const MAX_SKIP = 500;

function toItem(scan: IScan): ScanHistoryItem {
  return {
    id: String(scan._id),
    rawLabel: scan.rawLabel,
    diseaseKey: scan.diseaseKey,
    label: scan.label,
    labelSi: scan.labelSi ?? "",
    pathogen: scan.pathogen ?? "",
    severity: scan.severity,
    isHealthy: scan.isHealthy,
    confidence: scan.confidence,
    model: scan.model,
    summary: scan.summary ?? "",
    symptoms: scan.symptoms ?? [],
    treatments: scan.treatments ?? [],
    prevention: scan.prevention ?? [],
    predictions: scan.predictions ?? [],
    ...(scan.imageUrl ? { imageUrl: scan.imageUrl } : {}),
    scannedAt: new Date(scan.scannedAt).toISOString(),
  };
}

function readNumber(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    const body: ScanFailure = {
      ok: false,
      error: "You need to be signed in to view your scan history.",
    };

    return NextResponse.json(body, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const limit = readNumber(params.get("limit"), HISTORY_PAGE_SIZE, 48) || HISTORY_PAGE_SIZE;
  const skip = readNumber(params.get("skip"), 0, MAX_SKIP);

  try {
    await connectDB();

    // One extra row is a cheaper "is there more?" than a second count query.
    const [rows, stats] = await Promise.all([
      Scan.find({ clerkId: userId })
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(limit + 1)
        .lean<IScan[]>(),
      Scan.aggregate<{
        _id: null;
        total: number;
        healthy: number;
        averageConfidence: number;
      }>([
        { $match: { clerkId: userId } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            healthy: { $sum: { $cond: ["$isHealthy", 1, 0] } },
            averageConfidence: { $avg: "$confidence" },
          },
        },
      ]),
    ]);

    const hasMore = rows.length > limit;
    const summary = stats[0];

    const historyStats: HistoryStats = {
      total: summary?.total ?? 0,
      healthy: summary?.healthy ?? 0,
      diseased: (summary?.total ?? 0) - (summary?.healthy ?? 0),
      averageConfidence: summary?.averageConfidence ?? 0,
    };

    const body: HistorySuccess = {
      ok: true,
      items: rows.slice(0, limit).map(toItem),
      stats: historyStats,
      hasMore,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[disease-detect] Could not read scan history", error);

    const body: ScanFailure = {
      ok: false,
      error: "Your scan history could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    };

    return NextResponse.json(body, { status: 503 });
  }
}
