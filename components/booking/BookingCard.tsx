"use client";

import Link from "next/link";
import { Calendar, Clock, MapPin, Zap, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDuration, getConnectorLabel, getBookingStatusColor, formatPrice } from "@/lib/utils";
import type { IBooking, IStation } from "@/types";
import { format } from "date-fns";

interface BookingCardProps {
  booking: IBooking;
  onCancel?: (bookingId: string) => void;
  showActions?: boolean;
}

const statusVariantMap: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "info",
  active: "success",
  completed: "default",
  cancelled: "danger",
  "no-show": "danger",
};

export function BookingCard({ booking, onCancel, showActions = true }: BookingCardProps) {
  const station = typeof booking.stationId === "object" ? booking.stationId as IStation : null;
  const statusVariant = statusVariantMap[booking.status] || "default";

  const canCancel =
    showActions &&
    (booking.status === "pending" || booking.status === "confirmed");

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-card-foreground">
              {station ? station.name : "Charging Station"}
            </h3>
            <Badge variant={statusVariant}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>

          {station && (
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {station.location?.city}
                {station.location?.address
                  ? ` - ${station.location.address}`
                  : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Date</p>
            <p className="text-sm font-medium text-foreground">
              {format(new Date(booking.startTime), "MMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Time</p>
            <p className="text-sm font-medium text-foreground">
              {format(new Date(booking.startTime), "h:mm a")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm font-medium text-foreground">
              {formatDuration(booking.estimatedDuration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Deposit</p>
            <p className="text-sm font-medium text-foreground">
              {formatPrice(booking.deposit?.amount ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {showActions && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <Link
            href={`/booking/confirmation/${booking._id}`}
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            View Details
          </Link>
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(booking._id)}
              className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
