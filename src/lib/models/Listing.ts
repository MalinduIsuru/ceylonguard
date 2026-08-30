import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * One harvest a farmer has published to the marketplace: how much leaf, at
 * what price, from which district, picked when.
 *
 * When the listing is backed by a healthy leaf scan the verification is copied
 * in rather than read through the `scan` ref at display time — the same reason
 * `Scan` copies its treatment text: the stamp on a listing should keep saying
 * what it said the day the farmer published, even if the scan row is later
 * removed.
 */

export type ListingStatus = "active" | "sold" | "withdrawn";

/** The AI Disease Free Stamp, frozen at publish time. */
export type ListingVerification = {
  label: string;
  /** Percentage, 0 to 100. */
  confidence: number;
  scannedAt: Date;
  imageUrl?: string;
};

export interface IListing {
  _id: Types.ObjectId;
  clerkId: string;
  user?: Types.ObjectId;

  weightKg: number;
  /** Rupees per kilogram. */
  pricePerKg: number;
  district: string;
  /** Stored at UTC midnight: this is a calendar day, not an instant. */
  harvestDate: Date;

  status: ListingStatus;

  /** The healthy scan that earned the stamp, absent on an unverified listing. */
  scan?: Types.ObjectId;
  verification?: ListingVerification;

  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema = new Schema<ListingVerification>(
  {
    label: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    scannedAt: { type: Date, required: true },
    imageUrl: { type: String },
  },
  { _id: false },
);

const ListingSchema: Schema<IListing> = new Schema(
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

    weightKg: { type: Number, required: true, min: 1 },
    pricePerKg: { type: Number, required: true, min: 1 },
    district: { type: String, required: true, trim: true },
    harvestDate: { type: Date, required: true },

    status: {
      type: String,
      enum: ["active", "sold", "withdrawn"],
      default: "active",
      index: true,
    },

    scan: {
      type: Schema.Types.ObjectId,
      ref: "Scan",
    },
    verification: { type: VerificationSchema },
  },
  {
    timestamps: true,
  },
);

/** "My listings" is always this farmer's rows, newest first. */
ListingSchema.index({ clerkId: 1, createdAt: -1 });

/** The factory-side marketplace browses open stock, usually by district. */
ListingSchema.index({ status: 1, district: 1, createdAt: -1 });

/**
 * Used to check whether a scan has already been spent on a listing, so one
 * healthy leaf cannot stamp an unlimited number of harvests.
 */
ListingSchema.index({ scan: 1 }, { sparse: true });

const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>("Listing", ListingSchema);

export default Listing;
