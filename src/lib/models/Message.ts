import mongoose, { Model, Schema, Types } from "mongoose";

/**
 * One line in a conversation.
 *
 * `clientId` is the id the sender's browser gave the message before it had a
 * real one. It comes back on both the POST response and the realtime echo, so
 * a tab that has already drawn the message optimistically can recognise its
 * own line instead of drawing it twice.
 */

export interface IMessage {
  _id: Types.ObjectId;

  conversation: Types.ObjectId;
  senderClerkId: string;
  body: string;

  /** Sender-generated, unique only within that browser tab's session. */
  clientId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema<IMessage> = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderClerkId: { type: String, required: true },
    body: { type: String, required: true, trim: true },
    clientId: { type: String },
  },
  {
    timestamps: true,
  },
);

/** A thread reads newest-first and pages backwards from there. */
MessageSchema.index({ conversation: 1, createdAt: -1 });

const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);

export default Message;
