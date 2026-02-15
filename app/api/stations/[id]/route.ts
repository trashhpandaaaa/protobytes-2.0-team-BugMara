import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import { loadStationFromFile } from "@/lib/stations";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // If it's a file-based ID, load from file
    if (id.startsWith("station-")) {
      const station = loadStationFromFile(id);
      if (!station) {
        return NextResponse.json(
          { error: "Station not found" },
          { status: 404 }
        );
      }
      const response = NextResponse.json({ station }, { status: 200 });
      response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      return response;
    }

    await dbConnect();
    const station = await Station.findById(id).select("-__v").lean();
    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ station }, { status: 200 });
    response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("Error fetching station:", error);
    return NextResponse.json(
      { error: "Failed to fetch station" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    // Whitelist updatable fields — prevent overwriting rating, totalReviews, adminId
    const allowedFields: Record<string, unknown> = {};
    const whitelist = [
      "name", "location", "telephone", "vehicleTypes",
      "operatingHours", "chargingPorts", "pricing",
      "amenities", "photos", "isActive",
    ];
    for (const key of whitelist) {
      if (body[key] !== undefined) allowedFields[key] = body[key];
    }

    const station = await Station.findByIdAndUpdate(id, allowedFields, {
      new: true,
      runValidators: true,
    }).lean();

    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ station }, { status: 200 });
  } catch (error) {
    console.error("Error updating station:", error);
    return NextResponse.json(
      { error: "Failed to update station" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const station = await Station.findByIdAndDelete(id);
    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Station deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting station:", error);
    return NextResponse.json(
      { error: "Failed to delete station" },
      { status: 500 }
    );
  }
}
