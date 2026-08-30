import { auth } from "@clerk/nextjs/server";
import type { Types } from "mongoose";
import { NextResponse } from "next/server";

import {
  deleteScanImage,
  isCloudinaryConfigured,
  uploadScanImage,
  type UploadedImage,
} from "@/lib/cloudinary";
import {
  MAX_IMAGE_BYTES,
  mlServiceUrl,
  type PredictionRow,
  type ScanFailure,
  type ScanSuccess,
} from "@/lib/disease-detect";
import { getDiseaseInfo, isHealthy, type DiseaseInfo } from "@/lib/disease-info";
import connectDB from "@/lib/mongodb";
import Scan from "@/lib/models/Scan";
import User from "@/lib/models/User";

/**
 * Forwards a leaf photo to the FastAPI service that hosts
 * `src/ml-service/tea_trained_model.keras`, then attaches the treatment
 * guidance for whichever class wins.
 *
 * A successful prediction is archived: the photo goes to Cloudinary and the
 * result — disease, confidence and the treatment plan that was shown — goes to
 * MongoDB. Archiving is best effort, so a Cloudinary or database outage still
 * lets the farmer see their result; the response says whether it was saved.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TensorFlow's first prediction after a cold start can take a while. */
const INFERENCE_TIMEOUT_MS = 60_000;

const SERVICE_DOWN_HINT =
  "Start the model service with: cd src/ml-service && uvicorn fastapi_app:app --port 8000";

function fail(status: number, error: string, hint?: string) {
  const body: ScanFailure = hint ? { ok: false, error, hint } : { ok: false, error };

  return NextResponse.json(body, { status });
}

/** FastAPI puts its message in `detail`; fall back to raw text for anything else. */
async function readUpstreamDetail(response: Response): Promise<string | null> {
  try {
    const text = await response.text();

    if (!text) return null;

    try {
      const parsed = JSON.parse(text) as { detail?: unknown };

      if (typeof parsed.detail === "string") return parsed.detail;
    } catch {
      // Not JSON — fall through to the raw body.
    }

    return text.slice(0, 300);
  } catch {
    return null;
  }
}

type ArchiveInput = {
  clerkId: string;
  bytes: ArrayBuffer;
  fileName: string;
  info: DiseaseInfo;
  rawLabel: string;
  confidence: number;
  model: string;
  predictions: PredictionRow[];
  scannedAt: string;
};

type ArchiveOutcome = {
  saved: boolean;
  scanId?: string;
  imageUrl?: string;
  error?: string;
};

/**
 * Uploads the photo and writes the scan row.
 *
 * Never throws — the caller has a valid prediction to return either way, so a
 * storage problem is reported alongside the result instead of replacing it.
 * If the row fails after the upload landed, the image is removed again so
 * Cloudinary does not collect files nothing points at.
 */
async function archiveScan(input: ArchiveInput): Promise<ArchiveOutcome> {
  const { clerkId, bytes, fileName, info, rawLabel, confidence } = input;

  let image: UploadedImage | null = null;

  if (isCloudinaryConfigured()) {
    try {
      image = await uploadScanImage(Buffer.from(bytes), clerkId);
    } catch (error) {
      console.error("[disease-detect] Cloudinary upload failed", error);
    }
  } else {
    console.warn(
      "[disease-detect] Cloudinary is not configured — saving the scan without an image.",
    );
  }

  try {
    await connectDB();

    // Link to the Mongo user when there is one; scans still save without it.
    const user = await User.findOne({ clerkId })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();

    const scan = await Scan.create({
      clerkId,
      user: user?._id,

      rawLabel,
      diseaseKey: info.key,
      label: info.label,
      labelSi: info.labelSi,
      pathogen: info.pathogen,
      severity: info.severity,
      isHealthy: isHealthy(info),

      confidence,
      predictions: input.predictions,
      model: input.model,

      summary: info.summary,
      symptoms: info.symptoms,
      treatments: info.treatments,
      prevention: info.prevention,

      imageUrl: image?.url,
      imagePublicId: image?.publicId,
      imageWidth: image?.width,
      imageHeight: image?.height,
      imageFormat: image?.format,
      imageBytes: image?.bytes,
      originalFileName: fileName,

      scannedAt: new Date(input.scannedAt),
    });

    return {
      saved: true,
      scanId: String(scan._id),
      imageUrl: image?.url,
    };
  } catch (error) {
    console.error("[disease-detect] Could not save the scan", error);

    if (image) {
      try {
        await deleteScanImage(image.publicId);
      } catch (cleanupError) {
        console.error(
          "[disease-detect] Orphaned Cloudinary image",
          image.publicId,
          cleanupError,
        );
      }
    }

    return {
      saved: false,
      error: "The result could not be added to your scan history.",
    };
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, "You need to be signed in to run a scan.");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return fail(400, "The uploaded image could not be read. Try again.");
  }

  const image = form.get("image");

  if (!(image instanceof File)) {
    return fail(400, "No image was attached to the request.");
  }

  if (image.size === 0) {
    return fail(400, "The selected image is empty.");
  }

  if (!image.type.startsWith("image/")) {
    return fail(415, "Only image files can be scanned. Pick a JPG or PNG photo.");
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return fail(413, "Images must be 10 MB or smaller. Try a lower-resolution photo.");
  }

  const fileName = image.name || "leaf.jpg";

  // Read the bytes once: the same data feeds the model and the upload.
  let bytes: ArrayBuffer;

  try {
    bytes = await image.arrayBuffer();
  } catch {
    return fail(400, "The uploaded image could not be read. Try again.");
  }

  const upstreamForm = new FormData();
  upstreamForm.append("image", new Blob([bytes], { type: image.type }), fileName);

  let response: Response;

  try {
    response = await fetch(`${mlServiceUrl()}/predict`, {
      method: "POST",
      body: upstreamForm,
      cache: "no-store",
      signal: AbortSignal.timeout(INFERENCE_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    if (timedOut) {
      return fail(
        504,
        "The model took too long to respond.",
        "The first prediction after starting the service loads TensorFlow and can be slow. Try once more.",
      );
    }

    return fail(
      503,
      "Could not reach the tea disease model service.",
      SERVICE_DOWN_HINT,
    );
  }

  if (!response.ok) {
    const detail = await readUpstreamDetail(response);

    return fail(
      response.status === 413 || response.status === 400 ? response.status : 502,
      detail ?? `The model service returned status ${response.status}.`,
    );
  }

  let payload: {
    disease?: unknown;
    confidence?: unknown;
    model?: unknown;
    predictions?: unknown;
  };

  try {
    payload = await response.json();
  } catch {
    return fail(502, "The model service returned a response that could not be parsed.");
  }

  if (typeof payload.disease !== "string" || typeof payload.confidence !== "number") {
    return fail(502, "The model service returned an unexpected result shape.");
  }

  const rawRows = Array.isArray(payload.predictions) ? payload.predictions : [];

  const predictions: PredictionRow[] = rawRows
    .filter(
      (row): row is { disease: string; confidence: number } =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as { disease?: unknown }).disease === "string" &&
        typeof (row as { confidence?: unknown }).confidence === "number",
    )
    .map((row) => ({
      disease: row.disease,
      label: getDiseaseInfo(row.disease).label,
      confidence: row.confidence,
    }));

  const info = getDiseaseInfo(payload.disease);
  const model =
    typeof payload.model === "string" ? payload.model : "tea_trained_model.keras";
  const scannedAt = new Date().toISOString();

  const archive = await archiveScan({
    clerkId: userId,
    bytes,
    fileName,
    info,
    rawLabel: payload.disease,
    confidence: payload.confidence,
    model,
    predictions,
    scannedAt,
  });

  const result: ScanSuccess = {
    ok: true,
    rawLabel: payload.disease,
    info,
    confidence: payload.confidence,
    model,
    predictions,
    scannedAt,
    saved: archive.saved,
    ...(archive.scanId ? { scanId: archive.scanId } : {}),
    ...(archive.imageUrl ? { imageUrl: archive.imageUrl } : {}),
    ...(archive.error ? { saveError: archive.error } : {}),
  };

  return NextResponse.json(result);
}
