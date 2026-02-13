/**
 * ETA calculation using Mapbox Directions API.
 * Calculates driving distance and duration between two coordinates.
 */

interface Coordinates {
  lat: number;
  lng: number;
}

interface ETAResult {
  durationMinutes: number;
  distanceKm: number;
  updatedAt: Date;
}

/**
 * Calculate driving ETA from user location to station using Mapbox Directions API.
 */
export async function calculateETA(
  userLocation: Coordinates,
  stationLocation: Coordinates
): Promise<ETAResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error("NEXT_PUBLIC_MAPBOX_TOKEN not set");
    return null;
  }

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLocation.lng},${userLocation.lat};${stationLocation.lng},${stationLocation.lat}?access_token=${token}&overview=false`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("Mapbox Directions API error:", res.status);
      return null;
    }

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) {
      console.error("No route found between locations");
      return null;
    }

    return {
      durationMinutes: Math.round(route.duration / 60), // seconds → minutes
      distanceKm: Math.round((route.distance / 1000) * 10) / 10, // meters → km, 1 decimal
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error("Failed to calculate ETA:", error);
    return null;
  }
}

/**
 * Get station coordinates by ID — works for both file-based and DB stations.
 */
export async function getStationCoordinates(
  stationId: string
): Promise<Coordinates | null> {
  // Lazy imports to avoid circular deps
  const { loadStationFromFile } = await import("@/lib/stations");

  if (stationId.startsWith("station-")) {
    const station = loadStationFromFile(stationId);
    if (station?.location?.coordinates) {
      return station.location.coordinates;
    }
    return null;
  }

  // DB-based station
  const { default: dbConnect } = await import("@/lib/db");
  const { default: Station } = await import("@/lib/models/Station");
  await dbConnect();

  const station = await Station.findById(stationId).lean();
  if (station?.location?.coordinates) {
    return station.location.coordinates as Coordinates;
  }
  return null;
}
