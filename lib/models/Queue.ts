import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQueueDocument extends Document {
  userId: string;
  userName: string;
  stationId: string;
  position: number;
  status: "waiting" | "notified" | "expired" | "completed";
  notifiedAt?: Date;
  expiresAt?: Date;
  joinedAt: Date;
  createdAt: Date;
}

const QueueSchema = new Schema<IQueueDocument>(
  {
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    stationId: { type: String, required: true, index: true },
    position: { type: Number, required: true },
    status: {
      type: String,
      enum: ["waiting", "notified", "expired", "completed"],
      default: "waiting",
      index: true,
    },
    notifiedAt: { type: Date },
    expiresAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

QueueSchema.index({ stationId: 1, status: 1, position: 1 });
QueueSchema.index({ userId: 1, stationId: 1 });

const Queue: Model<IQueueDocument> =
  mongoose.models.Queue ||
  mongoose.model<IQueueDocument>("Queue", QueueSchema);

export default Queue;
