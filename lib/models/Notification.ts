import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotificationDocument extends Document {
  userId: string;
  type:
    | "port_available"
    | "booking_reminder"
    | "queue_turn"
    | "charging_complete"
    | "queue_update"
    | "general";
  title: string;
  message: string;
  stationId?: string;
  stationName?: string;
  portId?: string;
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: [
        "port_available",
        "booking_reminder",
        "queue_turn",
        "charging_complete",
        "queue_update",
        "general",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    stationId: { type: String },
    stationName: { type: String },
    portId: { type: String },
    read: { type: Boolean, default: false },
    actionUrl: { type: String },
  },
  { timestamps: true }
);

// Auto-delete notifications after 30 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>("Notification", NotificationSchema);

export default Notification;
