import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";
import { loadAllStationsFromFile } from "@/lib/stations";

/** Escape special regex characters to prevent ReDoS */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    const search = searchParams.get("search");
    const vehicleType = searchParams.get("vehicleType");

    // Load from cached file data
    let fileStations = loadAndFilterFileStations(city, search, vehicleType);

    // Also try to load DB stations and merge them in
    let dbStations: any[] = [];
    try {
      await dbConnect();
      const filter: Record<string, unknown> = { isActive: true };

      if (city) {
        filter["location.city"] = { $regex: escapeRegex(city), $options: "i" };
      }
      if (search) {
        const safeSearch = escapeRegex(search);
        filter.$or = [
          { name: { $regex: safeSearch, $options: "i" } },
          { "location.address": { $regex: safeSearch, $options: "i" } },
          { "location.city": { $regex: safeSearch, $options: "i" } },
        ];
      }
      if (vehicleType) {
        filter.vehicleTypes = vehicleType;
      }

      dbStations = await Station.find(filter)
        .sort({ createdAt: -1 })
        .select("-__v")
        .lean();
    } catch {
      // DB connection failed, just use file stations
    }

    // Merge: DB stations take priority over file stations with the same name
    const dbNames = new Set(dbStations.map((s) => s.name));
    const dedupedFileStations = fileStations.filter((s) => !dbNames.has(s.name));
    const stations = [...dbStations, ...dedupedFileStations];

    const response = NextResponse.json({ stations }, { status: 200 });
    // Cache for 30s, allow stale for 60s while revalidating
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=30, stale-while-revalidate=60"
    );
    return response;
  } catch (error) {
    console.error("Error fetching stations:", error);
    return NextResponse.json(
      { error: "Failed to fetch stations" },
      { status: 500 }
    );
  }
}

function loadAndFilterFileStations(
  city: string | null,
  search: string | null,
  vehicleType: string | null
) {
  let stations = loadAllStationsFromFile().filter((s) => s.isActive);

  if (city) {
    const cityLower = city.toLowerCase();
    stations = stations.filter((s) =>
      s.location.city.toLowerCase().includes(cityLower)
    );
  }

  if (search) {
    const q = search.toLowerCase();
    stations = stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.address.toLowerCase().includes(q) ||
        s.location.city.toLowerCase().includes(q)
    );
  }

  if (vehicleType) {
    stations = stations.filter((s) => s.vehicleTypes.includes(vehicleType));
  }

  return stations;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ clerkId: userId });
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Whitelist allowed fields to prevent overwriting rating/totalReviews
    const station = await Station.create({
      name: body.name,
      location: body.location,
      telephone: body.telephone || "",
      vehicleTypes: body.vehicleTypes || [],
      operatingHours: body.operatingHours || { open: "06:00", close: "22:00" },
      chargingPorts: body.chargingPorts || [],
      pricing: body.pricing || { perHour: 0 },
      amenities: body.amenities || [],
      photos: body.photos || [],
      adminId: userId,
      isActive: true,
      rating: 0,
      totalReviews: 0,
    });

    return NextResponse.json({ station }, { status: 201 });
  } catch (error) {
    console.error("Error creating station:", error);
    return NextResponse.json(
      { error: "Failed to create station" },
      { status: 500 }
    );
  }
}
