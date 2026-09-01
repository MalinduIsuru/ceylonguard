import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * The thread between one farmer and one factory about one harvest.
 *
 * A conversation is keyed on the trade rather than on the pair of people: two
 * mills bidding on the same harvest each get their own thread, and the same
 * mill talking to the same farmer about a second harvest gets a second one.
 * That is what lets the header say what is being discussed, and it is why the
 * unique index below is (listing, farmer, factory) rather than (farmer,
 * factory) — both sides open the thread from their own screen, and they have
 * to land on the same row.
 *
 * `participants` is the same two ids as an array so "my conversations" is one
 * indexed read; the named fields stay because almost every other read cares
 * which side of the trade someone is on.
 *
 * Unread counts and read marks are stored per side rather than counted from
 * the messages. A thread is opened far more often than it is written to, so
 * the count is kept correct on write and read back for free.
 */

export interface IConversation {
  _id: Types.ObjectId;

  /** The harvest under discussion; the row survives the listing's deletion. */
  listing: Types.ObjectId;
  /** The standing offer, when the thread was opened off one. */
  offer?: Types.ObjectId;

  farmerClerkId: string;
  factoryClerkId: string;
  /** `[farmerClerkId, factoryClerkId]`, for the inbox read and channel auth. */
  participants: string[];

  /** Preview for the conversation list, copied off the newest message. */
  lastMessageBody?: string;
  lastMessageSenderClerkId?: string;
  /** Also the inbox sort key, so an unopened thread sorts by its last word. */
  lastMessageAt?: Date;

  farmerReadAt?: Date;
  factoryReadAt?: Date;
  farmerUnread: number;
  factoryUnread: number;

  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema<IConversation> = new Schema(
  {
    listing: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
      index: true,
    },
    offer: { type: Schema.Types.ObjectId, ref: "Offer" },

    farmerClerkId: { type: String, required: true, index: true },
    factoryClerkId: { type: String, required: true, index: true },
    participants: { type: [String], required: true },

    lastMessageBody: { type: String },
    lastMessageSenderClerkId: { type: String },
    lastMessageAt: { type: Date },

    farmerReadAt: { type: Date },
    factoryReadAt: { type: Date },
    farmerUnread: { type: Number, default: 0, min: 0 },
    factoryUnread: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
);

/**
 * One thread per trade. The farmer opening it from their offers inbox and the
 * factory opening it from the marketplace both upsert against this key, so
 * whoever gets there first creates the row and the other one joins it.
 */
ConversationSchema.index(
  { listing: 1, farmerClerkId: 1, factoryClerkId: 1 },
  { unique: true },
);

/** The inbox: my threads, most recently spoken in first. */
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
