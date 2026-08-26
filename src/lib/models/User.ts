import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: "farmer" | "factory" | "none";
  district?: string;
  nic?: string;
  phone?: string;
  factoryName?: string;
  address?: string;
  onboardingCompleted?: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    role: {
      type: String,
      enum: ["farmer", "factory", "none"],
      default: "none",
    },
    district: {
      type: String,
    },
    nic: {
      type: String,
    },
    phone: {
      type: String,
    },
    factoryName: {
      type: String,
    },
    address: {
      type: String,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
