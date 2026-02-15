import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/stations/eta
 * Calculate driving ETA from user location to one or more stations.
 *
 * Body: {
 *   userLat: number,
 *   userLng: number,
 *   stations: Array<{ id: string, lat: number, lng: number }>
 * }
 *
 * Returns: { etas: Array<{ id: string, durationMinutes: number, distanceKm: number } | { id: string, error: true }> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userLat, userLng, stations } = body;

    if (!userLat || !userLng || !Array.isArray(stations) || stations.length === 0) {
      return NextResponse.json(
        { error: "Missing userLat, userLng, or stations array" },
        { status: 400 }
      );
    }

    // Limit to 10 stations max to avoid API abuse
    const stationsToProcess = stations.slice(0, 10);

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Mapbox token not configured" },
        { status: 500 }
      );
    }

    // Fetch ETAs in parallel
    const etaPromises = stationsToProcess.map(async (station: { id: string; lat: number; lng: number }) => {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${station.lng},${station.lat}?access_token=${token}&overview=false`;
        const res = await fetch(url);
        if (!res.ok) {
          return { id: station.id, error: true };
        }
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) {
          return { id: station.id, error: true };
        }
        return {
          id: station.id,
          durationMinutes: Math.round(route.duration / 60),
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        };
      } catch {
        return { id: station.id, error: true };
      }
    });

    const etas = await Promise.all(etaPromises);

    return NextResponse.json({ etas });
  } catch {
    return NextResponse.json(
      { error: "Failed to calculate ETAs" },
      { status: 500 }
    );
  }
}
