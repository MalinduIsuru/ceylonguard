import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * A confirmed purchase: the row that exists once a farmer accepts a mill's
 * offer and the harvest has to physically move.
 *
 * An order is created by the accept, never by a client, so there is no POST
 * behind it — `offer` is unique, which is what makes that creation idempotent
 * and stops one accepted bid from turning into two consignments.
 *
 * The commercial terms are copied off the offer and the harvest details off
 * the listing, both frozen at acceptance. That is the point of the row: an
 * order is what the two sides agreed, and it has to keep reading that way
 * after the farmer edits the listing or the listing is deleted outright.
 *
 * `timeline` is kept beside `status` rather than derived from it. The status
 * says where the leaf is; the timeline says when it got there and who said so,
 * which is the half that matters when a delivery is disputed.
 */

/** `cancelled` is terminal and reachable only while the order is confirmed. */
export type OrderStatus =
  | "confirmed"
  | "in_transit"
  | "delivered"
  | "cancelled";

/** One recorded move, appended on every status change. */
export interface IOrderEvent {
  status: OrderStatus;
  at: Date;
  /** Whoever made the move; the creating event is the accepting farmer. */
  byClerkId: string;
}

export interface IOrder {
  _id: Types.ObjectId;

  /** The accepted bid this order was struck on. Unique — see above. */
  offer: Types.ObjectId;
  /** The harvest, kept as a pointer; the order survives its deletion. */
  listing: Types.ObjectId;

  farmerClerkId: string;
  factoryClerkId: string;

  /** Names as they stood at acceptance, used when a profile has since gone. */
  farmerName?: string;
  factoryName?: string;

  /** Harvest details, copied off the listing at acceptance. */
  district: string;
  harvestDate: Date;

  /** Agreed terms, copied off the offer at acceptance. */
  weightKg: number;
  /** Rupees per kilogram. */
  pricePerKg: number;

  status: OrderStatus;
  /** When the offer was accepted, which is not always when the row wrote. */
  placedAt: Date;
  timeline: IOrderEvent[];

  cancelledByClerkId?: string;
  cancelledReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const OrderEventSchema = new Schema<IOrderEvent>(
  {
    status: {
      type: String,
      enum: ["confirmed", "in_transit", "delivered", "cancelled"],
      required: true,
    },
    at: { type: Date, required: true },
    byClerkId: { type: String, required: true },
  },
  { _id: false },
);

const OrderSchema: Schema<IOrder> = new Schema(
  {
    offer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      unique: true,
    },
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },

    farmerClerkId: { type: String, required: true, index: true },
    factoryClerkId: { type: String, required: true, index: true },

    farmerName: { type: String, trim: true },
    factoryName: { type: String, trim: true },

    district: { type: String, required: true, trim: true },
    harvestDate: { type: Date, required: true },

    weightKg: { type: Number, required: true, min: 1 },
    pricePerKg: { type: Number, required: true, min: 1 },

    status: {
      type: String,
      enum: ["confirmed", "in_transit", "delivered", "cancelled"],
      default: "confirmed",
      index: true,
    },
    placedAt: { type: Date, default: Date.now },
    timeline: { type: [OrderEventSchema], default: [] },

    cancelledByClerkId: { type: String },
    cancelledReason: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

/** The factory's order tracking screen: my purchases, newest first. */
OrderSchema.index({ factoryClerkId: 1, createdAt: -1 });

/** The same rows read from the selling side. */
OrderSchema.index({ farmerClerkId: 1, createdAt: -1 });

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
