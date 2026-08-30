import type {
  DiseaseInfo,
  DiseaseSeverity,
  TreatmentStep,
} from "@/lib/disease-info";

/** Shared contract between /api/disease-detect and the scan UI. */

export type PredictionRow = {
  /** Raw label straight from the model, e.g. "gray light". */
  disease: string;
  /** Human-facing name resolved through the treatment knowledge base. */
  label: string;
  /** Percentage, 0 to 100. */
  confidence: number;
};

export type ScanSuccess = {
  ok: true;
  rawLabel: string;
  info: DiseaseInfo;
  confidence: number;
  model: string;
  predictions: PredictionRow[];
  scannedAt: string;
  /** Mongo `_id` of the saved scan, absent when the save could not run. */
  scanId?: string;
  /** Cloudinary copy of the leaf photo, absent when the upload could not run. */
  imageUrl?: string;
  /** False when the prediction succeeded but nothing reached the database. */
  saved: boolean;
  /** Why the scan was not archived. Only set when `saved` is false. */
  saveError?: string;
};

export type ScanFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type ScanResponse = ScanSuccess | ScanFailure;

/** One archived scan, as returned by GET /api/disease-detect/history. */
export type ScanHistoryItem = {
  id: string;
  rawLabel: string;
  diseaseKey: string;
  label: string;
  labelSi: string;
  pathogen: string;
  severity: DiseaseSeverity;
  isHealthy: boolean;
  confidence: number;
  model: string;
  summary: string;
  symptoms: string[];
  treatments: TreatmentStep[];
  prevention: string[];
  predictions: PredictionRow[];
  imageUrl?: string;
  scannedAt: string;
};

/** Totals across every scan the farmer has run, not just the loaded page. */
export type HistoryStats = {
  total: number;
  healthy: number;
  diseased: number;
  averageConfidence: number;
};

export type HistorySuccess = {
  ok: true;
  items: ScanHistoryItem[];
  stats: HistoryStats;
  hasMore: boolean;
};

export type HistoryResponse = HistorySuccess | ScanFailure;

/** Page size for the history grid. */
export const HISTORY_PAGE_SIZE = 12;

/**
 * Rebuilds the shape `ScanResult` renders from an archived row.
 *
 * The treatment text is read back from the row rather than looked up again, so
 * reopening an old scan shows the advice that was given at the time.
 */
export function historyItemToResult(item: ScanHistoryItem): ScanSuccess {
  return {
    ok: true,
    rawLabel: item.rawLabel,
    info: {
      key: item.diseaseKey,
      label: item.label,
      labelSi: item.labelSi,
      pathogen: item.pathogen,
      severity: item.severity,
      summary: item.summary,
      symptoms: item.symptoms,
      treatments: item.treatments,
      prevention: item.prevention,
    },
    confidence: item.confidence,
    model: item.model,
    predictions: item.predictions,
    scannedAt: item.scannedAt,
    scanId: item.id,
    imageUrl: item.imageUrl,
    saved: true,
  };
}

export type HealthResponse = {
  online: boolean;
  serviceUrl: string;
  model?: string;
  classes?: string[];
  error?: string;
};

/** Below this the prediction is too weak to act on without a second opinion. */
export const LOW_CONFIDENCE_THRESHOLD = 60;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Trailing slashes break `${base}/predict`, so strip them once here. */
export function mlServiceUrl(): string {
  return (process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000").replace(
    /\/+$/,
    "",
  );
}
