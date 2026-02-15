import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPortSubscriptionDocument extends Document {
  userId: string;
  stationId: string;
  active: boolean;
  createdAt: Date;
}

const PortSubscriptionSchema = new Schema<IPortSubscriptionDocument>(
  {
    userId: { type: String, required: true },
    stationId: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PortSubscriptionSchema.index({ stationId: 1, active: 1 });
PortSubscriptionSchema.index({ userId: 1, stationId: 1 }, { unique: true });

const PortSubscription: Model<IPortSubscriptionDocument> =
  mongoose.models.PortSubscription ||
  mongoose.model<IPortSubscriptionDocument>(
    "PortSubscription",
    PortSubscriptionSchema
  );

export default PortSubscription;
