"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Navigation,
  RefreshCw,
  Clock,
  Zap,
} from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { IBooking, IStation } from "@/types";
import { format } from "date-fns";
import { calculateArrivalStatus, formatArrivalTime, getUrgencyIcon } from "@/lib/arrivalStatus";

type StatusFilter = "all" | "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no-show";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no-show", label: "No Show" },
];

const statusVariantMap: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  pending: "warning",
  confirmed: "info",
  active: "success",
  completed: "default",
  cancelled: "danger",
  "no-show": "danger",
};

/**
 * Real-time countdown timer for arrival status
 */
function RealtimeArrivalStatus({
  booking,
}: {
  booking: IBooking;
}) {
  const [arrivalStatus, setArrivalStatus] = useState(
    calculateArrivalStatus(
      new Date(booking.createdAt),
      booking.eta,
      new Date(booking.startTime)
    )
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setArrivalStatus(
        calculateArrivalStatus(
          new Date(booking.createdAt),
          booking.eta,
          new Date(booking.startTime)
        )
      );
    }, 1000); // Update every second for smooth countdown

    return () => clearInterval(interval);
  }, [booking]);

  if (!booking.eta) {
    return <span className="text-xs text-muted-foreground">No location data</span>;
  }

  return (
    <div className={cn("rounded-lg px-3 py-2", arrivalStatus.bgColor)}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{getUrgencyIcon(arrivalStatus.urgencyLevel)}</span>
        <div>
          <p className={cn("text-sm font-semibold", arrivalStatus.textColor)}>
            {arrivalStatus.statusLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Arrives at {formatArrivalTime(arrivalStatus.expectedArrivalTime)}
          </p>
          <p className="text-xs text-muted-foreground">
            {booking.eta.distanceKm} km away
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [refreshingEtaId, setRefreshingEtaId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bookings");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? data ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    setLoading(false);

    // Auto-refresh bookings every 5 minutes to refresh ETA
    const interval = setInterval(fetchBookings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    if (statusFilter === "all") return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  // Pre-calculate arrival statuses for all bookings to avoid recalculation
  const bookingArrivalStatuses = useMemo(() => {
    return bookings.reduce((acc, booking) => {
      if (booking.eta) {
        acc[booking._id] = calculateArrivalStatus(
          new Date(booking.createdAt),
          booking.eta,
          new Date(booking.startTime)
        );
      }
      return acc;
    }, {} as Record<string, ReturnType<typeof calculateArrivalStatus>>);
  }, [bookings]);

  const updateBookingStatus = async (
    bookingId: string,
    newStatus: string
  ) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b._id === bookingId
              ? { ...b, status: newStatus as IBooking["status"] }
              : b
          )
        );
      }
    } catch (err) {
      console.error("Failed to update booking:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const refreshETA = async (booking: IBooking) => {
    if (!booking.userLocation) return;

    setRefreshingEtaId(booking._id);
    try {
      const res = await fetch(`/api/bookings/${booking._id}/refresh-eta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userLocation: booking.userLocation }),
      });
      if (res.ok) {
        const data = await res.json();
        setBookings((prev) =>
          prev.map((b) =>
            b._id === booking._id ? { ...b, eta: data.booking.eta } : b
          )
        );
      }
    } catch (err) {
      console.error("Failed to refresh ETA:", err);
    } finally {
      setRefreshingEtaId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading bookings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Manage Bookings
            </h1>
            <p className="mt-1 text-muted-foreground">
              View and manage all bookings for your stations.
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === opt.value
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Bookings Table */}
        {filteredBookings.length === 0 ? (
          <div className="mt-8 rounded-xl border border-border bg-muted/50 p-8 text-center">
            <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-lg font-medium text-foreground">
              No bookings found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "No bookings have been made yet."
                : `No ${statusFilter} bookings.`}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Station
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Date / Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                      Arrival Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBookings.map((booking) => {
                    const station =
                      typeof booking.stationId === "object"
                        ? (booking.stationId as IStation)
                        : null;
                    const isLoading = actionLoadingId === booking._id;

                    return (
                      <tr
                        key={booking._id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {booking.userName || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {booking.userEmail || ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {station?.name || "Station"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">
                            {format(
                              new Date(booking.startTime),
                              "MMM d, yyyy"
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(booking.startTime), "h:mm a")}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDuration(booking.estimatedDuration)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              statusVariantMap[booking.status] || "default"
                            }
                          >
                            {booking.status.charAt(0).toUpperCase() +
                              booking.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {["pending", "confirmed"].includes(booking.status) ? (
                            <div className="flex items-center gap-2">
                              <RealtimeArrivalStatus booking={booking} />
                              {booking.eta && (
                                <button
                                  onClick={() => refreshETA(booking)}
                                  disabled={refreshingEtaId === booking._id}
                                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                  title="Refresh ETA"
                                >
                                  {refreshingEtaId === booking._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                {booking.status === "pending" && (
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(
                                        booking._id,
                                        "confirmed"
                                      )
                                    }
                                    className="rounded-lg p-2 text-blue-400 transition-colors hover:bg-blue-500/10"
                                    title="Confirm Booking"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                )}
                                {(booking.status === "active" ||
                                  booking.status === "confirmed" ||
                                  booking.status === "pending") && (
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(
                                        booking._id,
                                        "completed"
                                      )
                                    }
                                    className="rounded-lg p-2 text-green-400 transition-colors hover:bg-green-500/10"
                                    title="Mark Complete"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                )}
                                {(booking.status === "confirmed" ||
                                  booking.status === "pending") && (
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(
                                        booking._id,
                                        "no-show"
                                      )
                                    }
                                    className="rounded-lg p-2 text-orange-400 transition-colors hover:bg-orange-500/10"
                                    title="Mark No-Show"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </button>
                                )}
                                {(booking.status === "pending" ||
                                  booking.status === "confirmed") && (
                                  <button
                                    onClick={() =>
                                      updateBookingStatus(
                                        booking._id,
                                        "cancelled"
                                      )
                                    }
                                    className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10"
                                    title="Cancel"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Walk-in Availability Section */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Walk-in Availability
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Available ports for users arriving without reservations while waiting for bookings:
          </p>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const delayedBookings = bookings.filter(b => {
                  if (!["pending", "confirmed"].includes(b.status) || !b.eta) {
                    return false;
                  }
                  const arrivalStatus = bookingArrivalStatuses[b._id];
                  return arrivalStatus && arrivalStatus.isOverdue && Math.abs(arrivalStatus.minutesUntilArrival) > 15;
                });

                const urgentBookings = bookings.filter(b => {
                  if (!["pending", "confirmed"].includes(b.status) || !b.eta) {
                    return false;
                  }
                  const arrivalStatus = bookingArrivalStatuses[b._id];
                  return arrivalStatus && (arrivalStatus.urgencyLevel === "urgent" || arrivalStatus.urgencyLevel === "approaching");
                });

                return (
                  <>
                    {delayedBookings.length > 0 && (
                      <div className="rounded-lg bg-red-500/10 p-4 border border-red-500/20">
                        <p className="text-sm font-semibold text-red-400 mb-2">
                          🔺 Slots Available - Users Delayed ({delayedBookings.length})
                        </p>
                        <ul className="text-xs text-red-400 space-y-1">
                          {delayedBookings.map(b => {
                            const status = bookingArrivalStatuses[b._id];
                            return (
                              <li key={b._id}>
                                {b.userName} - Delayed by{" "}
                                {Math.round(Math.abs(status?.minutesUntilArrival ?? 0))}{" "}
                                mins
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {urgentBookings.length > 0 && (
                      <div className="rounded-lg bg-yellow-500/10 p-4 border border-yellow-500/20">
                        <p className="text-sm font-semibold text-yellow-400 mb-2">
                          🟡 Slots Reserved Soon - Arriving in 15 mins ({urgentBookings.length})
                        </p>
                        <ul className="text-xs text-yellow-400 space-y-1">
                          {urgentBookings.map(b => {
                            const status = bookingArrivalStatuses[b._id];
                            return (
                              <li key={b._id}>
                                {b.userName} - Arrives in{" "}
                                {Math.round(status?.minutesUntilArrival ?? 0)}{" "}
                                mins
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {delayedBookings.length === 0 && urgentBookings.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No slots available for walk-ins. All reserved users are expected to arrive on time.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
