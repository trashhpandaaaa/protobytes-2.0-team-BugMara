import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBookingDocument extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  stationId: mongoose.Types.ObjectId | string;
  portId: mongoose.Types.ObjectId | string;
  startTime: Date;
  estimatedDuration: number;
  endTime: Date;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no-show";
  deposit: {
    amount: number;
    khaltiPidx?: string;
    khaltiTransactionId?: string;
    refunded: boolean;
  };
  qrCode?: string;
  userLocation?: {
    lat: number;
    lng: number;
  };
  eta?: {
    durationMinutes: number;
    distanceKm: number;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBookingDocument>(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    stationId: {
      type: Schema.Types.Mixed,
      required: true,
      index: true,
    },
    portId: { type: Schema.Types.Mixed, required: true },
    startTime: { type: Date, required: true },
    estimatedDuration: { type: Number, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "active", "completed", "cancelled", "no-show"],
      default: "pending",
      index: true,
    },
    deposit: {
      amount: { type: Number, default: 0 },
      khaltiPidx: { type: String },
      khaltiTransactionId: { type: String },
      refunded: { type: Boolean, default: false },
    },
    qrCode: { type: String },
    userLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    eta: {
      durationMinutes: { type: Number },
      distanceKm: { type: Number },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

BookingSchema.index({ startTime: 1, endTime: 1 });
BookingSchema.index({ stationId: 1, portId: 1, startTime: 1 });

const Booking: Model<IBookingDocument> =
  mongoose.models.Booking ||
  mongoose.model<IBookingDocument>("Booking", BookingSchema);

export default Booking;
