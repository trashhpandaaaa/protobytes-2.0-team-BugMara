import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Clock,
  Star,
  Zap,
  Wifi,
  ParkingCircle,
  UtensilsCrossed,
  Coffee,
  Hotel,
  Bath,
  Fuel,
  CircleDot,
  ArrowLeft,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  cn,
  getConnectorLabel,
  formatPrice,
  getStatusColor,
} from "@/lib/utils";
import { ETADisplay } from "@/components/station/ETADisplay";
import { LivePortStatus } from "@/components/station/LivePortStatus";
import { NotifyMeButton } from "@/components/station/NotifyMeButton";
import { QueueManager } from "@/components/station/QueueManager";
import { loadStationFromFile } from "@/lib/stations";
import dbConnect from "@/lib/db";
import Station from "@/lib/models/Station";
import Review from "@/lib/models/Review";
import type { IStation, IReview } from "@/types";

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  parking: ParkingCircle,
  food: UtensilsCrossed,
  coffee: Coffee,
  accomodation: Hotel,
  restroom: Bath,
  petrol: Fuel,
};

const amenityLabels: Record<string, string> = {
  wifi: "WiFi",
  parking: "Parking",
  food: "Food",
  coffee: "Coffee",
  accomodation: "Accommodation",
  restroom: "Restroom",
  petrol: "Petrol",
};

/** Direct data access — no self-referencing API call */
async function getStation(id: string): Promise<IStation | null> {
  try {
    // File-based station
    if (id.startsWith("station-")) {
      return loadStationFromFile(id) as IStation | null;
    }
    // DB station
    await dbConnect();
    const station = await Station.findById(id).select("-__v").lean();
    return station ? (JSON.parse(JSON.stringify(station)) as IStation) : null;
  } catch {
    return null;
  }
}

async function getReviews(stationId: string): Promise<IReview[]> {
  try {
    await dbConnect();
    const reviews = await Review.find({ stationId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("-__v")
      .lean();
    return JSON.parse(JSON.stringify(reviews)) as IReview[];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const station = await getStation(id);
  if (!station) return { title: "Station Not Found | Urja Station" };
  return {
    title: `${station.name} | Urja Station`,
    description: `Book EV charging at ${station.name} in ${station.location?.address ?? "Nepal"}. ${station.chargingPorts?.length || 0} ports available.`,
  };
}

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [station, reviews] = await Promise.all([
    getStation(id),
    getReviews(id),
  ]);

  if (!station) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Station Not Found
          </h2>
          <p className="mt-2 text-muted-foreground">
            The station you are looking for does not exist.
          </p>
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

  const availablePorts =
    station.chargingPorts?.filter((p) => p.status === "available").length ?? 0;
  const totalPorts = station.chargingPorts?.length ?? 0;

  const statusConfig: Record<
    string,
    {
      label: string;
      variant: "success" | "danger" | "warning" | "default";
    }
  > = {
    available: { label: "Available", variant: "success" },
    occupied: { label: "Occupied", variant: "danger" },
    reserved: { label: "Reserved", variant: "warning" },
    maintenance: { label: "Maintenance", variant: "default" },
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Stations
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Station Header */}
            <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-card-foreground">
                    {station.name}
                  </h1>
                  <div className="mt-2 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {station.location?.address}, {station.location?.city}
                      {station.location?.province
                        ? `, ${station.location.province}`
                        : ""}
                    </span>
                  </div>
                </div>
                {station.rating > 0 && (
                  <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5">
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                    <span className="text-lg font-bold text-foreground">
                      {station.rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({station.totalReviews} reviews)
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {station.telephone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-4 w-4" />
                    <span>{station.telephone}</span>
                  </div>
                )}
                {station.operatingHours && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>
                      {station.operatingHours.open} -{" "}
                      {station.operatingHours.close}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            {station.location?.coordinates && (
              <div className="mt-6 overflow-hidden rounded-xl border border-border/50">
                <div className="h-[300px] bg-muted relative">
                  <img
                    alt={`Map showing ${station.name} location`}
                    width={800}
                    height={300}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+3b82f6(${station.location.coordinates.lng},${station.location.coordinates.lat})/${station.location.coordinates.lng},${station.location.coordinates.lat},14,0/800x300@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""}`}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${station.location.coordinates.lat},${station.location.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground border border-border/50 hover:bg-card transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open in Google Maps
                  </a>
                </div>
              </div>
            )}

            {/* Charging Ports — Live SSE updates */}
            <LivePortStatus
              stationId={id}
              initialPorts={station.chargingPorts || []}
            />

            {/* Reviews Section */}
            <div className="mt-6 rounded-xl border border-border/50 bg-card p-6">
              <h2 className="text-lg font-semibold text-card-foreground">
                Reviews
              </h2>

              {reviews.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No reviews yet. Be the first to leave a review!
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review._id}
                      className="border-b border-border pb-4 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {(review.userName || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {review.userName || "Anonymous"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                "h-4 w-4",
                                star <= review.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-600"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {review.comment}
                      </p>
                      {review.response && (
                        <div className="mt-2 rounded-lg bg-muted p-3">
                          <p className="text-xs font-medium text-foreground">
                            Station Response
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {review.response.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* ETA / Arrival Time */}
            {station.location?.coordinates && (
              <ETADisplay
                stationLat={station.location.coordinates.lat}
                stationLng={station.location.coordinates.lng}
              />
            )}

            {/* Pricing */}
            {station.pricing && (
              <div className="rounded-xl border border-border/50 bg-card p-6">
                <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Pricing
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Per Hour
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {formatPrice(station.pricing.perHour)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Book Now */}
            <Link
              href={`/booking/${id}`}
              className="block w-full rounded-xl bg-primary py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90"
            >
              Book Now
            </Link>

            {/* Notify Me When Free */}
            <NotifyMeButton
              stationId={id}
              hasAvailablePorts={availablePorts > 0}
            />

            {/* Virtual Queue */}
            <QueueManager
              stationId={id}
              hasAvailablePorts={availablePorts > 0}
            />

            {/* Amenities */}
            {station.amenities && station.amenities.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card p-6">
                <h3 className="font-semibold text-card-foreground">
                  Amenities
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {station.amenities.map((amenity) => {
                    const Icon = amenityIcons[amenity] || CircleDot;
                    const label = amenityLabels[amenity] || amenity;
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2"
                      >
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Operating Hours */}
            {station.operatingHours && (
              <div className="rounded-xl border border-border/50 bg-card p-6">
                <h3 className="flex items-center gap-2 font-semibold text-card-foreground">
                  <Clock className="h-5 w-5 text-primary" />
                  Operating Hours
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  {station.operatingHours.open} - {station.operatingHours.close}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
