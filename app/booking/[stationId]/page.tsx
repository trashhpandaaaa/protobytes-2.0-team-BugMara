"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Zap,
  CreditCard,
  Loader2,
} from "lucide-react";
import { cn, formatPrice, getConnectorLabel, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { IStation } from "@/types";

const DURATION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
  { value: 240, label: "4 hr" },
];

export default function BookingPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const router = useRouter();
  const [stationId, setStationId] = useState<string>("");
  const [station, setStation] = useState<IStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [selectedPortId, setSelectedPortId] = useState("");

  useEffect(() => {
    params.then((p) => setStationId(p.stationId));
  }, [params]);

  useEffect(() => {
    if (!stationId) return;

    async function fetchStation() {
      try {
        const res = await fetch(`/api/stations/${stationId}`);
        if (res.ok) {
          const data = await res.json();
          setStation(data.station ?? data);
        }
      } catch (err) {
        console.error("Failed to fetch station:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStation();
  }, [stationId]);

  const availablePorts =
    station?.chargingPorts?.filter((p) => p.status === "available") ?? [];

  const depositAmount = station?.pricing?.depositAmount ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedDate || !selectedTime || !selectedPortId) {
      setError("Please fill in all required fields.");
      return;
    }

    // Validate the booking is not in the past
    const bookingTime = new Date(`${selectedDate}T${selectedTime}`);
    if (isNaN(bookingTime.getTime())) {
      setError("Invalid date or time selected.");
      return;
    }
    if (bookingTime <= new Date()) {
      setError("Booking time must be in the future.");
      return;
    }

    // Validate against operating hours
    if (station?.operatingHours) {
      const [openH, openM] = station.operatingHours.open.split(":").map(Number);
      const [closeH, closeM] = station.operatingHours.close.split(":").map(Number);
      const bookingH = bookingTime.getHours();
      const bookingM = bookingTime.getMinutes();
      const bookingMinutes = bookingH * 60 + bookingM;
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      if (bookingMinutes < openMinutes || bookingMinutes >= closeMinutes) {
        setError(
          `Station operates between ${station.operatingHours.open} and ${station.operatingHours.close}. Please select a valid time.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}`).toISOString();

      // Check availability first
      const checkRes = await fetch("/api/bookings/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          portId: selectedPortId,
          startTime,
          estimatedDuration: selectedDuration,
        }),
      });

      if (!checkRes.ok) {
        const checkData = await checkRes.json();
        setError(
          checkData.message || "Selected time slot is not available."
        );
        setSubmitting(false);
        return;
      }

      // Create booking via Khalti payment
      const payRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stationId,
          portId: selectedPortId,
          startTime,
          estimatedDuration: selectedDuration,
        }),
      });

      if (!payRes.ok) {
        if (payRes.status === 401) {
          // Session expired — redirect to sign-in and come back
          window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        const payData = await payRes.json().catch(() => ({}));
        setError(payData.error || `Payment request failed (${payRes.status}). Please try again.`);
        setSubmitting(false);
        return;
      }

      const payData = await payRes.json();

      // Redirect user to Khalti payment page
      window.location.href = payData.payment_url;
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading station details...
          </p>
        </div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Station Not Found
          </h2>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Stations
          </Link>
        </div>
      </div>
    );
  }

  // Determine today as minimum date
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Back Link */}
        <Link
          href={`/stations/${stationId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Station
        </Link>

        <h1 className="text-2xl font-bold text-foreground">Book a Charger</h1>

        {/* Station Summary */}
        <div className="mt-6 rounded-xl border border-border/50 bg-card p-5">
          <h2 className="font-semibold text-card-foreground">{station.name}</h2>
          <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>
              {station.location?.address}, {station.location?.city}
            </span>
          </div>
          {station.pricing && (
            <div className="mt-3 flex items-center gap-4">
              <Badge variant="info">
                {formatPrice(station.pricing.perHour)}/hr
              </Badge>
              <Badge variant="default">
                Deposit: {formatPrice(station.pricing.depositAmount)}
              </Badge>
            </div>
          )}
        </div>

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Date & Time */}
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Select Date & Time
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Date
                </label>
                <input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Arrival Time
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Charging Duration
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedDuration(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                    selectedDuration === opt.value
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Port Selection */}
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
              <Zap className="h-5 w-5 text-primary" />
              Select Charging Port
              <span className="text-sm font-normal text-muted-foreground">
                ({availablePorts.length} available)
              </span>
            </h3>

            {station.chargingPorts && station.chargingPorts.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {station.chargingPorts.map((port) => {
                  const portId = String(port._id || port.portNumber);
                  const isAvailable = port.status === "available";
                  const isSelected = selectedPortId === portId;

                  return (
                    <div
                      key={portId}
                      role="button"
                      tabIndex={isAvailable ? 0 : -1}
                      onClick={() => {
                        if (isAvailable) {
                          setSelectedPortId(portId);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && isAvailable) {
                          e.preventDefault();
                          setSelectedPortId(portId);
                        }
                      }}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        isAvailable
                          ? "cursor-pointer hover:border-primary/50 hover:shadow-md"
                          : "cursor-not-allowed opacity-50",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              isAvailable ? "bg-green-100" : "bg-gray-100"
                            )}
                          >
                            <Zap
                              className={cn(
                                "h-4 w-4",
                                isAvailable ? "text-green-600" : "text-gray-500"
                              )}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-card-foreground">
                              Port {port.portNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getConnectorLabel(port.connectorType)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={isAvailable ? "success" : "default"}>
                          {isAvailable ? "Available" : port.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        {port.powerOutput && (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {port.powerOutput}
                          </span>
                        )}
                        {port.chargerType && (
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                            {port.chargerType}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="mt-2 text-xs font-medium text-primary">
                          ✓ Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No ports available at this station.
              </p>
            )}
          </div>

          {/* Deposit Summary */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">
                  Deposit Amount
                </span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {formatPrice(depositAmount)}
              </span>
            </div>
            {station?.pricing?.perHour > 0 && selectedDuration > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-primary/10 pt-3">
                <span className="text-sm text-muted-foreground">
                  Estimated charging cost ({formatDuration(selectedDuration)})
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatPrice(station.pricing.perHour * (selectedDuration / 60))}
                </span>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              This deposit will be refunded if you cancel before your booking
              starts.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !selectedPortId}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-sm transition-colors",
              submitting || !selectedPortId
                ? "cursor-not-allowed bg-primary/50"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Confirm & Pay Deposit
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
