import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * One harvest a farmer has published to the marketplace: how much leaf, at
 * what price, from which district, picked when.
 *
 * A listing stands on its own — publishing one needs nothing but the harvest
 * details, and the farmer can edit those for as long as the row exists.
 */

export type ListingStatus = "active" | "sold" | "withdrawn";

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

  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  },
);

/** "My listings" is always this farmer's rows, newest first. */
ListingSchema.index({ clerkId: 1, createdAt: -1 });

/** The factory-side marketplace browses open stock, usually by district. */
ListingSchema.index({ status: 1, district: 1, createdAt: -1 });

const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>("Listing", ListingSchema);

export default Listing;
