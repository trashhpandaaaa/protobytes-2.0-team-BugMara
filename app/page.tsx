"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search,
  MapIcon,
  List,
  Zap,
  Loader2,
  MapPin,
  Battery,
  Star,
  ChevronRight,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StationCard } from "@/components/station/StationCard";
import { StationMap } from "@/components/map/StationMap";
import { NearbyStations } from "@/components/station/NearbyStations";
import { RoutePlanner, type RouteData } from "@/components/station/RoutePlanner";
import { Spinner } from "@/components/ui/Spinner";
import type { IStation } from "@/types";

type ViewMode = "map" | "list";
type FilterTab = "all" | "available" | "fast";

/** Calculate bearing from point A to point B in degrees (0=north, CW) */
function calcBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLng = (lng2 - lng1) * toRad;
  const y = Math.sin(dLng) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export default function HomePage() {
  const [stations, setStations] = useState<IStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeStationIds, setRouteStationIds] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [userSpeed, setUserSpeed] = useState<number | null>(null);
  const [navigationMode, setNavigationMode] = useState(false);

  // For computing heading from position changes
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function fetchStations() {
      try {
        const res = await fetch("/api/stations");
        if (res.ok) {
          const data = await res.json();
          setStations(data.stations ?? data);
        } else {
          setFetchError("Failed to load stations. Please try again.");
        }
      } catch (err) {
        console.error("Failed to fetch stations:", err);
        setFetchError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    }
    fetchStations();
  }, []);

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = station.name.toLowerCase().includes(query);
        const matchesCity = station.location?.city
          ?.toLowerCase()
          .includes(query);
        const matchesAddress = station.location?.address
          ?.toLowerCase()
          .includes(query);
        if (!matchesName && !matchesCity && !matchesAddress) return false;
      }

      if (filterTab === "available") {
        const hasAvailable = station.chargingPorts?.some(
          (p) => p.status === "available"
        );
        if (!hasAvailable) return false;
      }

      if (filterTab === "fast") {
        const hasFast = station.chargingPorts?.some(
          (p) => p.powerOutput && Number(p.powerOutput) >= 50
        );
        if (!hasFast) return false;
      }

      return true;
    });
  }, [stations, searchQuery, filterTab]);

  // When a route is active, only show stations on the route
  const displayStations = useMemo(() => {
    if (routeStationIds.size > 0) {
      return filteredStations.filter((s) => routeStationIds.has(s._id));
    }
    return filteredStations;
  }, [filteredStations, routeStationIds]);

  const availableCount = useMemo(
    () =>
      stations.filter((s) =>
        s.chargingPorts?.some((p) => p.status === "available")
      ).length,
    [stations]
  );

  const handleRouteFound = useCallback((route: RouteData | null) => {
    setRouteData(route);
  }, []);

  const handleStationsOnRoute = useCallback((stns: IStation[]) => {
    setRouteStationIds(new Set(stns.map((s) => s._id)));
  }, []);

  const handleUserLocated = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
    prevLocationRef.current = { lat, lng };

    // Start continuous GPS tracking via watchPosition
    if (watchIdRef.current == null && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };

          // Compute heading from previous position if moved > 5m
          const prev = prevLocationRef.current;
          if (prev) {
            const dlat = newLoc.lat - prev.lat;
            const dlng = newLoc.lng - prev.lng;
            const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111320; // rough meters
            if (distApprox > 5) {
              const bearing = calcBearing(prev.lat, prev.lng, newLoc.lat, newLoc.lng);
              setUserHeading(bearing);
              prevLocationRef.current = newLoc;
            }
          }

          // Use device heading if available
          if (pos.coords.heading != null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
            setUserHeading(pos.coords.heading);
          }

          // Speed from GPS
          if (pos.coords.speed != null && !isNaN(pos.coords.speed)) {
            setUserSpeed(pos.coords.speed);
          }

          setUserLocation(newLoc);
        },
        () => { /* ignore watch errors */ },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );
    }
  }, []);

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const handleToggleNavigation = useCallback(() => {
    setNavigationMode((prev) => !prev);
  }, []);

  const [mobilePanel, setMobilePanel] = useState(false);

  /* ── Shared panel content (used in both desktop sidebar and mobile sheet) ── */
  const panelContent = (
    <>
      {/* Header */}
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-foreground">Stations</h1>
            <p className="text-xs text-muted-foreground">
              {displayStations.length} stations found
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode("map")}
              className={cn(
                "rounded-lg p-2 transition-colors",
                viewMode === "map"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5"
              )}
            >
              <MapIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-2 transition-colors",
                viewMode === "list"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-card py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* Filter Tabs */}
        <div className="mt-3 flex gap-2">
          {[
            { key: "all" as const, label: "All" },
            { key: "available" as const, label: "Available" },
            { key: "fast" as const, label: "Fast" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filterTab === tab.key
                  ? "bg-primary text-white"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <NearbyStations stations={stations} onLocate={handleUserLocated} />
        <RoutePlanner
          stations={stations}
          onRouteFound={handleRouteFound}
          onStationsOnRoute={handleStationsOnRoute}
        />

        <div>
          {!loading && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-2">
              {routeStationIds.size > 0 ? `Stations on Route (${displayStations.length})` : "Station List"}
            </p>
          )}
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="md" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <Zap className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Something went wrong
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fetchError}
              </p>
              <button
                onClick={() => { setFetchError(""); setLoading(true); fetch("/api/stations").then(r => r.json()).then(d => { setStations(d.stations ?? d); }).catch(() => setFetchError("Failed to load stations.")).finally(() => setLoading(false)); }}
                className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                Try Again
              </button>
            </div>
          ) : filteredStations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No stations found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try different search terms
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayStations.map((station) => (
                <StationListCard
                  key={station._id}
                  station={station}
                  highlighted={routeStationIds.has(station._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* ───────── Desktop Left Panel ───────── */}
      <div className="hidden lg:flex w-[380px] shrink-0 flex-col border-r border-border/50 bg-surface">
        {panelContent}
      </div>

      {/* ───────── Map / Grid (full height on mobile) ───────── */}
      <div className="flex-1 relative min-h-0">
        {viewMode === "map" ? (
          <StationMap
            stations={displayStations}
            className="h-full w-full"
            routeData={routeData}
            highlightedStationIds={routeStationIds}
            userLocation={userLocation}
            userHeading={userHeading}
            userSpeed={userSpeed}
            navigationMode={navigationMode}
            onToggleNavigation={handleToggleNavigation}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4 lg:p-6">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {displayStations.map((station) => (
                <div key={station._id} className="card-hover animate-fade-in-up">
                  <StationCard station={station} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Mobile: floating search bar + panel toggle ── */}
        {!navigationMode && (
          <div className="absolute top-3 left-14 right-3 z-10 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search stations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setMobilePanel(true)}
                  className="w-full rounded-xl border border-border/60 bg-card/95 backdrop-blur-md py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground shadow-lg focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => setMobilePanel(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card/95 backdrop-blur-md border border-border/60 shadow-lg text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Mobile: bottom quick-actions pill ── */}
        {!navigationMode && !mobilePanel && (
          <div className="absolute bottom-4 left-3 right-3 z-10 lg:hidden">
            <div className="flex items-center gap-2 rounded-2xl bg-card/95 backdrop-blur-md border border-border/50 p-2 shadow-xl">
              <button
                onClick={() => { setMobilePanel(true); }}
                className="flex flex-1 items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-xs font-medium text-primary"
              >
                <MapPin className="h-3.5 w-3.5" />
                {displayStations.length} Stations
              </button>
              <button
                onClick={() => setViewMode(viewMode === "map" ? "list" : "map")}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs font-medium text-foreground"
              >
                {viewMode === "map" ? <List className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
                {viewMode === "map" ? "List" : "Map"}
              </button>
              {[
                { key: "all" as const, label: "All" },
                { key: "available" as const, label: "Open" },
                { key: "fast" as const, label: "Fast" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={cn(
                    "rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
                    filterTab === tab.key
                      ? "bg-primary text-white"
                      : "bg-white/5 text-muted-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ───────── Mobile bottom sheet overlay ───────── */}
      {mobilePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobilePanel(false)}
          />
          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-surface border-t border-border/50 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-border/60" />
            </div>
            {panelContent}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── Compact Station Card for Sidebar ────────── */
function StationListCard({ station, highlighted }: { station: IStation; highlighted?: boolean }) {
  const availablePorts =
    station.chargingPorts?.filter((p) => p.status === "available").length ?? 0;
  const totalPorts = station.chargingPorts?.length ?? 0;
  const maxPower = Math.max(
    ...(station.chargingPorts?.map((p) => Number(p.powerOutput) || 0) ?? [0])
  );

  return (
    <Link
      href={`/stations/${station._id}`}
      className={cn(
        "group flex gap-3 rounded-xl border p-3 transition-all hover:border-primary/30 hover:bg-card/80",
        highlighted
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/50 bg-card"
      )}
    >
      {/* Availability indicator */}
      <div className="flex flex-col items-center justify-center">
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold",
            availablePorts > 0
              ? "bg-success/15 text-success"
              : "bg-destructive/15 text-destructive"
          )}
        >
          {availablePorts}/{totalPorts}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {station.name}
        </h3>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {station.location?.address || station.location?.city || "Unknown"}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Battery className="h-3 w-3" />
            {maxPower}kW
          </span>
          {station.rating && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Star className="h-3 w-3 fill-amber-400" />
              {station.rating.toFixed(1)}
            </span>
          )}
          <span
            className={cn(
              "text-xs font-medium",
              availablePorts > 0 ? "text-success" : "text-destructive"
            )}
          >
            {availablePorts > 0 ? "Available" : "Busy"}
          </span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/50 group-hover:text-primary transition-colors" />
    </Link>
  );
}
