"use client";

import Link from "next/link";
import {
  MapPin,
  Star,
  Heart,
  Zap,
  Wifi,
  ParkingCircle,
  UtensilsCrossed,
  Coffee,
  Hotel,
  Bath,
  Fuel,
  CircleDot,
  Car,
} from "lucide-react";
import { cn, getConnectorLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { IStation } from "@/types";
import { useState, useEffect } from "react";

const amenityLabels: Record<string, string> = {
  wifi: "WiFi",
  parking: "Parking",
  food: "Food",
  coffee: "Coffee",
  accomodation: "Accommodation",
  accommodation: "Accommodation",
  restroom: "Restroom",
  petrol: "Petrol",
};

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  parking: ParkingCircle,
  food: UtensilsCrossed,
  coffee: Coffee,
  accomodation: Hotel,
  restroom: Bath,
  petrol: Fuel,
};

interface StationCardProps {
  station: IStation;
  onToggleFavorite?: (stationId: string) => void;
  isFavorite?: boolean;
  etaMinutes?: number | null;
  etaDistanceKm?: number | null;
}

export function StationCard({
  station,
  onToggleFavorite,
  isFavorite = false,
  etaMinutes,
  etaDistanceKm,
}: StationCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);

  // Sync local state when prop changes (e.g., after re-fetch)
  useEffect(() => {
    setFavorite(isFavorite);
  }, [isFavorite]);

  const availablePorts =
    station.chargingPorts?.filter((p) => p.status === "available").length ?? 0;
  const totalPorts = station.chargingPorts?.length ?? 0;

  const connectorTypes = station.chargingPorts
    ?.map((p) => p.connectorType)
    .filter((v, i, a) => a.indexOf(v) === i) ?? [];

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorite(!favorite);
    onToggleFavorite?.(station._id);
  };

  return (
    <Link href={`/stations/${station._id}`} className="group block">
      <div className="rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {station.name}
            </h3>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {station.location?.city}
                {station.location?.address
                  ? ` - ${station.location.address}`
                  : ""}
              </span>
            </div>
          </div>

          <button
            onClick={handleFavoriteClick}
            className="rounded-full p-1.5 transition-colors hover:bg-red-500/10"
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-colors",
                favorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground hover:text-red-400"
              )}
            />
          </button>
        </div>

        {/* ETA / Driving Time */}
        {etaMinutes != null && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-1">
              <Car className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">
                {etaMinutes < 60
                  ? `${etaMinutes} min`
                  : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`}
              </span>
            </div>
            {etaDistanceKm != null && (
              <span className="text-xs text-muted-foreground">
                {etaDistanceKm} km drive
              </span>
            )}
          </div>
        )}

        {/* Connector Types */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {connectorTypes.map((type) => (
            <Badge key={type} variant="info">
              <Zap className="mr-1 h-3 w-3" />
              {getConnectorLabel(type)}
            </Badge>
          ))}
        </div>

        {/* Amenities */}
        {station.amenities && station.amenities.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            {station.amenities.slice(0, 5).map((amenity) => {
              const Icon = amenityIcons[amenity] || CircleDot;
              return (
                <div
                  key={amenity}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-muted"
                  title={amenityLabels[amenity] || amenity}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              );
            })}
            {station.amenities.length > 5 && (
              <span className="text-xs text-muted-foreground">
                +{station.amenities.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                availablePorts > 0 ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-red-500"
              )}
            />
            <span className="text-sm text-muted-foreground">
              <span
                className={cn(
                  "font-medium",
                  availablePorts > 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {availablePorts}
              </span>
              /{totalPorts} ports available
            </span>
          </div>

          {station.rating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium text-foreground">
                {station.rating.toFixed(1)}
              </span>
              {station.totalReviews > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({station.totalReviews})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
