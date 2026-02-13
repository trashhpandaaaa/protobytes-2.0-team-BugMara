import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";

async function verifyAdmin(userId: string) {
  await dbConnect();
  const user = await User.findOne({ clerkId: userId });
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;
  return user;
}

// Check that a station admin owns the station; superadmins can access any
async function verifyStationAccess(user: { role: string; clerkId: string }, stationId: string) {
  const station = await Station.findById(stationId).lean();
  if (!station) return { station: null, allowed: false };
  if (user.role === "superadmin") return { station, allowed: true };
  // Station admin: can only access their own stations
  return { station, allowed: station.adminId === user.clerkId };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { station, allowed } = await verifyStationAccess(user, id);

    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    if (!allowed) {
      return NextResponse.json(
        { error: "You can only access your own stations" },
        { status: 403 }
      );
    }

    return NextResponse.json({ station }, { status: 200 });
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

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Station admins can only edit their own stations
    const { allowed } = await verifyStationAccess(user, id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only edit your own stations" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Whitelist updatable fields
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Station admins can only patch their own stations
    const { allowed } = await verifyStationAccess(user, id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only edit your own stations" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Whitelist patchable fields
    const patchable: Record<string, unknown> = {};
    const patchWhitelist = [
      "name", "location", "telephone", "vehicleTypes",
      "operatingHours", "chargingPorts", "pricing",
      "amenities", "photos", "isActive",
    ];
    for (const key of patchWhitelist) {
      if (body[key] !== undefined) patchable[key] = body[key];
    }

    const station = await Station.findByIdAndUpdate(
      id,
      { $set: patchable },
      { new: true }
    ).lean();

    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ station }, { status: 200 });
  } catch (error) {
    console.error("Error patching station:", error);
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

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Station admins can only delete their own stations
    const { allowed } = await verifyStationAccess(user, id);
    if (!allowed) {
      return NextResponse.json(
        { error: "You can only delete your own stations" },
        { status: 403 }
      );
    }

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
