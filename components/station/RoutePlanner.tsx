"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Route,
  MapPin,
  Navigation,
  X,
  Loader2,
  ChevronRight,
  Battery,
  Star,
  AlertCircle,
  Zap,
  Crosshair,
} from "lucide-react";
import Link from "next/link";
import { cn, pointToRouteDistance } from "@/lib/utils";
import type { IStation } from "@/types";

interface RoutePlannerProps {
  stations: IStation[];
  onRouteFound?: (route: RouteData | null) => void;
  onStationsOnRoute?: (stations: IStation[]) => void;
}

export interface RouteStep {
  maneuver: {
    instruction: string;
    type: string;        // "turn", "depart", "arrive", "merge", etc.
    modifier?: string;   // "left", "right", "straight", "slight left", etc.
    location: [number, number]; // [lng, lat]
    bearing_after: number;
    bearing_before: number;
  };
  distance: number; // meters
  duration: number; // seconds
  name: string;     // road name
}

export interface RouteData {
  geometry: {
    coordinates: [number, number][];
  };
  distance: number; // meters
  duration: number; // seconds
  steps: RouteStep[];
}

interface GeocodeSuggestion {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

const CORRIDOR_KM = 5; // stations within 5km of the route

export function RoutePlanner({
  stations,
  onRouteFound,
  onStationsOnRoute,
}: RoutePlannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [pointA, setPointA] = useState("");
  const [pointB, setPointB] = useState("");
  const [coordA, setCoordA] = useState<[number, number] | null>(null);
  const [coordB, setCoordB] = useState<[number, number] | null>(null);
  const [suggestionsA, setSuggestionsA] = useState<GeocodeSuggestion[]>([]);
  const [suggestionsB, setSuggestionsB] = useState<GeocodeSuggestion[]>([]);
  const [showSugA, setShowSugA] = useState(false);
  const [showSugB, setShowSugB] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeStations, setRouteStations] = useState<
    (IStation & { routeDistance: number })[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const geocode = useCallback(
    async (query: string): Promise<GeocodeSuggestion[]> => {
      if (!token || query.length < 3) return [];
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,locality,neighborhood,address,poi&country=NP`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.features?.map((f: any) => ({
          place_name: f.place_name,
          center: f.center,
        })) ?? [];
      } catch {
        return [];
      }
    },
    [token]
  );

  const handleInputChange = (
    value: string,
    field: "A" | "B"
  ) => {
    if (field === "A") {
      setPointA(value);
      setCoordA(null);
    } else {
      setPointB(value);
      setCoordB(null);
    }

    // Reset route when inputs change
    if (routeData) {
      setRouteData(null);
      setRouteStations([]);
      onRouteFound?.(null);
      onStationsOnRoute?.([]);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await geocode(value);
      if (field === "A") {
        setSuggestionsA(results);
        setShowSugA(results.length > 0);
      } else {
        setSuggestionsB(results);
        setShowSugB(results.length > 0);
      }
    }, 300);
  };

  const selectSuggestion = (
    suggestion: GeocodeSuggestion,
    field: "A" | "B"
  ) => {
    if (field === "A") {
      setPointA(suggestion.place_name);
      setCoordA(suggestion.center);
      setShowSugA(false);
    } else {
      setPointB(suggestion.place_name);
      setCoordB(suggestion.center);
      setShowSugB(false);
    }
  };

  const useMyLocation = useCallback(
    async (field: "A" | "B") => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser");
        return;
      }
      setLocating(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { longitude, latitude } = position.coords;
          const coords: [number, number] = [longitude, latitude];
          // Reverse geocode for a readable name
          let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          if (token) {
            try {
              const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&limit=1&types=place,locality,neighborhood,address`
              );
              if (res.ok) {
                const data = await res.json();
                if (data.features?.[0]?.place_name) {
                  name = data.features[0].place_name;
                }
              }
            } catch { /* use coords as fallback */ }
          }
          if (field === "A") {
            setPointA(name);
            setCoordA(coords);
          } else {
            setPointB(name);
            setCoordB(coords);
          }
          setLocating(false);
        },
        (err) => {
          setError(
            err.code === 1
              ? "Location access denied. Please allow location in your browser."
              : "Unable to get your location. Please try again."
          );
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },
    [token]
  );

  const findRoute = async () => {
    if (!coordA || !coordB || !token) return;

    setRouteLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordA[0]},${coordA[1]};${coordB[0]},${coordB[1]}?geometries=geojson&overview=full&steps=true&banner_instructions=true&access_token=${token}`
      );

      if (!res.ok) throw new Error("Failed to fetch route");

      const data = await res.json();
      const route = data.routes?.[0];

      if (!route) {
        setError("No route found between these points");
        setRouteLoading(false);
        return;
      }

      const rd: RouteData = {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        steps: (route.legs?.[0]?.steps ?? []).map((s: any) => ({
          maneuver: {
            instruction: s.maneuver?.instruction ?? "",
            type: s.maneuver?.type ?? "",
            modifier: s.maneuver?.modifier ?? "",
            location: s.maneuver?.location ?? [0, 0],
            bearing_after: s.maneuver?.bearing_after ?? 0,
            bearing_before: s.maneuver?.bearing_before ?? 0,
          },
          distance: s.distance ?? 0,
          duration: s.duration ?? 0,
          name: s.name ?? "",
        })),
      };

      setRouteData(rd);
      onRouteFound?.(rd);

      // Find stations along the route corridor
      const routeCoords: [number, number][] = route.geometry.coordinates;
      const onRoute = stations
        .filter(
          (s) => s.location?.coordinates?.lat && s.location?.coordinates?.lng
        )
        .map((station) => {
          const dist = pointToRouteDistance(
            station.location.coordinates.lat,
            station.location.coordinates.lng,
            routeCoords
          );
          return { ...station, routeDistance: dist };
        })
        .filter((s) => s.routeDistance <= CORRIDOR_KM)
        .sort((a, b) => a.routeDistance - b.routeDistance);

      setRouteStations(onRoute);
      onStationsOnRoute?.(onRoute);
    } catch (err) {
      setError("Failed to calculate route. Please try again.");
      console.error(err);
    } finally {
      setRouteLoading(false);
    }
  };

  const clearRoute = () => {
    setPointA("");
    setPointB("");
    setCoordA(null);
    setCoordB(null);
    setRouteData(null);
    setRouteStations([]);
    setError(null);
    onRouteFound?.(null);
    onStationsOnRoute?.([]);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-primary/30"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
          <Route className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="text-left">
          <h3 className="text-sm font-semibold text-foreground">
            Route Planner
          </h3>
          <p className="text-xs text-muted-foreground">
            Find charging stations along your route
          </p>
        </div>
        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Route className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Route Planner
          </h3>
        </div>
        <button
          onClick={() => {
            setExpanded(false);
            clearRoute();
          }}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Inputs */}
      <div className="p-4 space-y-3">
        {/* Point A */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20">
              <div className="h-2 w-2 rounded-full bg-green-400" />
            </div>
            <input
              type="text"
              placeholder="Starting point..."
              value={pointA}
              onChange={(e) => handleInputChange(e.target.value, "A")}
              onFocus={() => suggestionsA.length > 0 && setShowSugA(true)}
              onBlur={() => setTimeout(() => setShowSugA(false), 200)}
              className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => useMyLocation("A")}
              disabled={locating}
              title="Use my current location"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )}
            </button>
          </div>
          {showSugA && suggestionsA.length > 0 && (
            <div className="absolute left-8 right-0 top-full z-50 mt-1 rounded-lg border border-border/50 bg-card shadow-xl">
              {suggestionsA.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => selectSuggestion(s, "A")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg"
                >
                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Connector line */}
        <div className="ml-3 h-4 w-px bg-border/50" />

        {/* Point B */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20">
              <div className="h-2 w-2 rounded-full bg-red-400" />
            </div>
            <input
              type="text"
              placeholder="Destination..."
              value={pointB}
              onChange={(e) => handleInputChange(e.target.value, "B")}
              onFocus={() => suggestionsB.length > 0 && setShowSugB(true)}
              onBlur={() => setTimeout(() => setShowSugB(false), 200)}
              className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          {showSugB && suggestionsB.length > 0 && (
            <div className="absolute left-8 right-0 top-full z-50 mt-1 rounded-lg border border-border/50 bg-card shadow-xl">
              {suggestionsB.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => selectSuggestion(s, "B")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-white/5 first:rounded-t-lg last:rounded-b-lg"
                >
                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={findRoute}
            disabled={!coordA || !coordB || routeLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {routeLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4" />
                Find Route
              </>
            )}
          </button>
          {routeData && (
            <button
              onClick={clearRoute}
              className="rounded-lg border border-border/50 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Route Info */}
      {routeData && (
        <div className="border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium text-foreground">
                {(routeData.distance / 1000).toFixed(1)} km
              </span>
            </span>
            <span>
              ~{Math.round(routeData.duration / 60)} min drive
            </span>
            <span className="flex items-center gap-1 text-primary font-medium">
              <Zap className="h-3.5 w-3.5" />
              {routeStations.length} stations on route
            </span>
          </div>
        </div>
      )}

      {/* Stations on route */}
      {routeStations.length > 0 && (
        <div className="border-t border-border/50">
          <div className="px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Charging Stops Along Route
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {routeStations.map((station) => {
              const availablePorts =
                station.chargingPorts?.filter((p) => p.status === "available")
                  .length ?? 0;
              const totalPorts = station.chargingPorts?.length ?? 0;

              return (
                <Link
                  key={station._id}
                  href={`/stations/${station._id}`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {station.name}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{station.routeDistance.toFixed(1)}km from route</span>
                      <span
                        className={cn(
                          "font-medium",
                          availablePorts > 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {availablePorts}/{totalPorts} available
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
