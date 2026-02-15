"use client";

import { useState, useEffect } from "react";
import { Car, Clock, MapPin, Loader2, Navigation } from "lucide-react";

interface ETADisplayProps {
  stationLat: number;
  stationLng: number;
}

export function ETADisplay({ stationLat, stationLng }: ETADisplayProps) {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [eta, setEta] = useState<{
    durationMinutes: number;
    distanceKm: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    setLocationLoading(true);
    setError(null);
    setRequested(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location access denied"
            : "Could not get location"
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!userLocation) return;

    async function fetchETA() {
      setLoading(true);
      try {
        const res = await fetch("/api/stations/eta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userLat: userLocation!.lat,
            userLng: userLocation!.lng,
            stations: [
              { id: "target", lat: stationLat, lng: stationLng },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const result = data.etas?.[0];
          if (result && !result.error) {
            setEta({
              durationMinutes: result.durationMinutes,
              distanceKm: result.distanceKm,
            });
          } else {
            setError("No route found");
          }
        } else {
          setError("Failed to calculate ETA");
        }
      } catch {
        setError("Failed to calculate ETA");
      } finally {
        setLoading(false);
      }
    }

    fetchETA();
  }, [userLocation, stationLat, stationLng]);

  // Before user requests location
  if (!requested) {
    return (
      <button
        onClick={requestLocation}
        className="flex w-full items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left transition-colors hover:bg-blue-500/10 hover:border-blue-500/30"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
          <Navigation className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Get Arrival Time
          </p>
          <p className="text-xs text-muted-foreground">
            Calculate driving time from your location
          </p>
        </div>
      </button>
    );
  }

  // Loading states
  if (locationLoading || loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
          <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {locationLoading ? "Getting your location..." : "Calculating route..."}
          </p>
          <p className="text-xs text-muted-foreground">
            Using Mapbox Directions API
          </p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
          <Navigation className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{error}</p>
          <button
            onClick={requestLocation}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ETA results
  if (eta) {
    const hours = Math.floor(eta.durationMinutes / 60);
    const mins = eta.durationMinutes % 60;
    const timeStr =
      hours > 0 ? `${hours}h ${mins}m` : `${eta.durationMinutes} min`;

    return (
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Car className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-foreground">
            Estimated Arrival Time
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-card/50 p-3">
            <Clock className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-lg font-bold text-foreground">{timeStr}</p>
              <p className="text-[10px] text-muted-foreground">Drive time</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-card/50 p-3">
            <MapPin className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-lg font-bold text-foreground">
                {eta.distanceKm} km
              </p>
              <p className="text-[10px] text-muted-foreground">Distance</p>
            </div>
          </div>
        </div>
        <button
          onClick={requestLocation}
          className="mt-2 text-[11px] text-primary hover:underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  return null;
}
