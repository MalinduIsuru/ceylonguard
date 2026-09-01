import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * A price a factory has put on one farmer's harvest listing.
 *
 * The listing's asking price and weight are copied in at offer time for the
 * same reason `Listing` copies its verification: the offer is a statement
 * about the harvest as it was advertised, and it should keep reading that way
 * after the farmer edits or removes the listing.
 *
 * `farmerClerkId` is denormalised off the listing so the farmer's "Offers
 * received" screen is one indexed read rather than a join.
 */

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface IOffer {
  _id: Types.ObjectId;

  listing: Types.ObjectId;
  /** Owner of the listing, copied from it at offer time. */
  farmerClerkId: string;

  factoryClerkId: string;
  factoryUser?: Types.ObjectId;
  /** Mill name as onboarded, shown to the farmer instead of a person's name. */
  factoryName?: string;

  /** Rupees per kilogram the factory is willing to pay. */
  pricePerKg: number;
  /** The listing's asking price when the offer was made. */
  askingPricePerKg: number;
  /** The listing's weight when the offer was made. */
  weightKg: number;

  message?: string;
  status: OfferStatus;

  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema: Schema<IOffer> = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    farmerClerkId: { type: String, required: true, index: true },

    factoryClerkId: { type: String, required: true, index: true },
    factoryUser: { type: Schema.Types.ObjectId, ref: "User" },
    factoryName: { type: String, trim: true },

    pricePerKg: { type: Number, required: true, min: 1 },
    askingPricePerKg: { type: Number, required: true, min: 1 },
    weightKg: { type: Number, required: true, min: 1 },

    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "withdrawn"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * One standing offer per factory per listing: re-submitting the form moves the
 * price on the existing row rather than stacking a second bid beside it.
 */
OfferSchema.index({ listing: 1, factoryClerkId: 1 }, { unique: true });

/** "Offers I have sent", newest first — what the marketplace page reads back. */
OfferSchema.index({ factoryClerkId: 1, createdAt: -1 });

/** "Offers on my harvests", newest first. */
OfferSchema.index({ farmerClerkId: 1, createdAt: -1 });

const Offer: Model<IOffer> =
  mongoose.models.Offer || mongoose.model<IOffer>("Offer", OfferSchema);

export default Offer;
