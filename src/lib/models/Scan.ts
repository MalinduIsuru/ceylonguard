import mongoose, { Model, Schema, Types } from "mongoose";

import type { DiseaseSeverity } from "@/lib/disease-info";

/**
 * One saved run of the tea disease model: the winning class, its confidence,
 * the treatment plan that was shown, and the Cloudinary copy of the leaf photo.
 *
 * The treatment text is copied in rather than looked up at read time, so an
 * old scan keeps showing the advice the farmer actually acted on even after
 * `src/lib/disease-info.ts` is edited.
 */

export type ScanPrediction = {
  disease: string;
  label: string;
  confidence: number;
};

export type ScanTreatment = {
  title: string;
  detail: string;
};

/**
 * Plain document shape rather than one extending `Document`: this schema has a
 * `model` field, which would clash with Mongoose's own `Document.model()`.
 */
export interface IScan {
  _id: Types.ObjectId;
  clerkId: string;
  user?: Types.ObjectId;

  /** Raw label straight from the model, e.g. "gray light". */
  rawLabel: string;
  /** Normalised knowledge-base key, e.g. "gray blight". */
  diseaseKey: string;
  label: string;
  labelSi?: string;
  pathogen?: string;
  severity: DiseaseSeverity;
  isHealthy: boolean;

  /** Percentage, 0 to 100. */
  confidence: number;
  predictions: ScanPrediction[];
  model: string;

  summary?: string;
  symptoms: string[];
  treatments: ScanTreatment[];
  prevention: string[];

  imageUrl?: string;
  imagePublicId?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFormat?: string;
  imageBytes?: number;
  originalFileName?: string;

  scannedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PredictionSchema = new Schema<ScanPrediction>(
  {
    disease: { type: String, required: true },
    label: { type: String, required: true },
    confidence: { type: Number, required: true },
  },
  { _id: false },
);

const TreatmentSchema = new Schema<ScanTreatment>(
  {
    title: { type: String, required: true },
    detail: { type: String, required: true },
  },
  { _id: false },
);

const ScanSchema: Schema<IScan> = new Schema(
  {
    clerkId: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    rawLabel: { type: String, required: true },
    diseaseKey: { type: String, required: true, index: true },
    label: { type: String, required: true },
    labelSi: { type: String },
    pathogen: { type: String },
    severity: {
      type: String,
      enum: ["healthy", "low", "moderate", "high"],
      required: true,
    },
    isHealthy: { type: Boolean, default: false, index: true },

    confidence: { type: Number, required: true, min: 0, max: 100 },
    predictions: { type: [PredictionSchema], default: [] },
    model: { type: String, default: "tea_trained_model.keras" },

    summary: { type: String },
    symptoms: { type: [String], default: [] },
    treatments: { type: [TreatmentSchema], default: [] },
    prevention: { type: [String], default: [] },

    imageUrl: { type: String },
    imagePublicId: { type: String },
    imageWidth: { type: Number },
    imageHeight: { type: Number },
    imageFormat: { type: String },
    imageBytes: { type: Number },
    originalFileName: { type: String },

    scannedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

/** Scan history is always "this farmer's scans, newest first". */
ScanSchema.index({ clerkId: 1, scannedAt: -1 });

const Scan: Model<IScan> =
  mongoose.models.Scan || mongoose.model<IScan>("Scan", ScanSchema);

export default Scan;
