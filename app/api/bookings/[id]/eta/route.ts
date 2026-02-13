import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Booking from "@/lib/models/Booking";
import { calculateETA, getStationCoordinates } from "@/lib/eta";

/**
 * PUT /api/bookings/[id]/eta
 * Updates the user's location and recalculates ETA to the station.
 * Only the booking owner can update.
 */
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
    const { id } = await params;
    const body = await req.json();
    const { lat, lng } = body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required as numbers" },
        { status: 400 }
      );
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Only the booking owner can update their ETA
    if (booking.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only allow ETA updates for active bookings
    if (!["pending", "confirmed", "active"].includes(booking.status)) {
      return NextResponse.json(
        { error: "ETA can only be updated for active bookings" },
        { status: 400 }
      );
    }

    const stationCoords = await getStationCoordinates(
      String(booking.stationId)
    );
    if (!stationCoords) {
      return NextResponse.json(
        { error: "Could not determine station location" },
        { status: 500 }
      );
    }

    const eta = await calculateETA({ lat, lng }, stationCoords);
    if (!eta) {
      return NextResponse.json(
        { error: "Could not calculate ETA" },
        { status: 500 }
      );
    }

    booking.userLocation = { lat, lng };
    booking.eta = eta;
    await booking.save();

    return NextResponse.json(
      {
        eta: {
          durationMinutes: eta.durationMinutes,
          distanceKm: eta.distanceKm,
          updatedAt: eta.updatedAt,
        },
        userLocation: { lat, lng },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating ETA:", error);
    return NextResponse.json(
      { error: "Failed to update ETA" },
      { status: 500 }
    );
  }
}
