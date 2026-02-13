import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";
import { loadAllStationsFromFile } from "@/lib/stations";

async function verifyAdmin(userId: string) {
  await dbConnect();
  const user = await User.findOne({ clerkId: userId });
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;
  return user;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Station admins only see their own stations; superadmins see all
    const filter = user.role === "admin" ? { adminId: userId } : {};
    const dbStations = await Station.find(filter).sort({ createdAt: -1 }).lean();

    // For demo: also include all stations from stations.json so the admin panel
    // has a full station list to work with
    const fileStations = loadAllStationsFromFile();
    const dbIds = new Set(dbStations.map((s) => String(s.name)));
    const extraFileStations = fileStations.filter((s) => !dbIds.has(s.name));

    const stations = [...dbStations, ...extraFileStations];

    return NextResponse.json({ stations }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admin stations:", error);
    return NextResponse.json(
      { error: "Failed to fetch stations" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyAdmin(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const station = await Station.create({
      ...body,
      adminId: userId,
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
