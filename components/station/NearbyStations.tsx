"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Navigation,
  Loader2,
  MapPin,
  Battery,
  Star,
  ChevronRight,
  Locate,
  AlertCircle,
  Clock,
  Car,
} from "lucide-react";
import { cn, haversineDistance } from "@/lib/utils";
import type { IStation } from "@/types";

interface ETAData {
  id: string;
  durationMinutes: number;
  distanceKm: number;
}

interface NearbyStationsProps {
  stations: IStation[];
  onLocate?: (lat: number, lng: number) => void;
}

export function NearbyStations({ stations, onLocate }: NearbyStationsProps) {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [located, setLocated] = useState(false);
  const [etaMap, setEtaMap] = useState<Record<string, ETAData>>({});
  const [etaLoading, setEtaLoading] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        setLocated(true);
        setLoading(false);
        onLocate?.(loc.lat, loc.lng);
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location access denied. Please enable location permissions."
            : "Unable to determine your location. Please try again."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const nearestStations = useMemo(() => {
    if (!userLocation) return [];

    return stations
      .filter(
        (s) => s.location?.coordinates?.lat && s.location?.coordinates?.lng
      )
      .map((station) => ({
        ...station,
        distance: haversineDistance(
          userLocation.lat,
          userLocation.lng,
          station.location.coordinates.lat,
          station.location.coordinates.lng
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [stations, userLocation]);

  // Fetch driving ETA for nearest stations
  const fetchETAs = useCallback(async () => {
    if (!userLocation || nearestStations.length === 0) return;

    setEtaLoading(true);
    try {
      const res = await fetch("/api/stations/eta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userLat: userLocation.lat,
          userLng: userLocation.lng,
          stations: nearestStations.map((s) => ({
            id: s._id,
            lat: s.location.coordinates.lat,
            lng: s.location.coordinates.lng,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const map: Record<string, ETAData> = {};
        for (const eta of data.etas) {
          if (!eta.error) {
            map[eta.id] = eta;
          }
        }
        setEtaMap(map);
      }
    } catch (err) {
      console.error("Failed to fetch ETAs:", err);
    } finally {
      setEtaLoading(false);
    }
  }, [userLocation, nearestStations]);

  useEffect(() => {
    if (located && nearestStations.length > 0) {
      fetchETAs();
    }
  }, [located, nearestStations.length, fetchETAs]);

  if (!located) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <Navigation className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Nearby Stations
            </h3>
            <p className="text-xs text-muted-foreground">
              Find the 5 closest stations to you
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={requestLocation}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Locating...
            </>
          ) : (
            <>
              <Locate className="h-4 w-4" />
              Use My Location
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
            <Navigation className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Nearest Stations
          </h3>
        </div>
        <button
          onClick={requestLocation}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Locate className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="divide-y divide-border/30">
        {nearestStations.map((station, idx) => {
          const availablePorts =
            station.chargingPorts?.filter((p) => p.status === "available")
              .length ?? 0;
          const totalPorts = station.chargingPorts?.length ?? 0;
          const maxPower = Math.max(
            ...(station.chargingPorts?.map((p) => Number(p.powerOutput) || 0) ??
              [0])
          );
          const eta = etaMap[station._id];

          return (
            <Link
              key={station._id}
              href={`/stations/${station._id}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
            >
              {/* Rank */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {station.name}
                </h4>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {/* Driving ETA */}
                  {eta ? (
                    <span className="flex items-center gap-1 text-blue-400 font-medium">
                      <Car className="h-3 w-3" />
                      {eta.durationMinutes < 60
                        ? `${eta.durationMinutes} min`
                        : `${Math.floor(eta.durationMinutes / 60)}h ${eta.durationMinutes % 60}m`}
                    </span>
                  ) : etaLoading ? (
                    <span className="flex items-center gap-1 text-blue-400/60">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[10px]">ETA...</span>
                    </span>
                  ) : null}
                  {/* Driving distance (from ETA) or haversine fallback */}
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {eta
                      ? `${eta.distanceKm} km`
                      : station.distance < 1
                        ? `${Math.round(station.distance * 1000)}m`
                        : `${station.distance.toFixed(1)}km`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Battery className="h-3 w-3" />
                    {maxPower}kW
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      availablePorts > 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {availablePorts}/{totalPorts}
                  </span>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
