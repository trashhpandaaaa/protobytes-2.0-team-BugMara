import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Booking from "@/lib/models/Booking";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";
import { loadStationFromFile } from "@/lib/stations";

async function verifyAdmin(userId: string) {
  await dbConnect();
  const user = await User.findOne({ clerkId: userId });
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) return null;
  return user;
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
    const { qrData, action } = body;

    if (!qrData) {
      return NextResponse.json(
        { error: "QR data is required" },
        { status: 400 }
      );
    }

    // Parse QR data
    let parsed: {
      bookingId?: string;
      stationId?: string;
      portId?: string;
      startTime?: string;
      endTime?: string;
    };

    try {
      parsed = JSON.parse(qrData);
    } catch {
      return NextResponse.json(
        { error: "Invalid QR code format" },
        { status: 400 }
      );
    }

    if (!parsed.bookingId) {
      return NextResponse.json(
        { error: "QR code does not contain a valid booking ID" },
        { status: 400 }
      );
    }

    await dbConnect();

    const booking = await Booking.findById(parsed.bookingId).lean();
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Enrich with station data
    const sid = String(booking.stationId);
    let stationData = null;
    if (sid.startsWith("station-")) {
      stationData = loadStationFromFile(sid);
    } else {
      stationData = await Station.findById(booking.stationId)
        .select("name location chargingPorts pricing adminId")
        .lean();
    }

    // Station admins can only scan bookings for their own stations
    if (user.role === "admin" && !sid.startsWith("station-")) {
      if (!stationData || (stationData as Record<string, unknown>).adminId !== userId) {
        return NextResponse.json(
          { error: "You can only scan bookings for your own stations" },
          { status: 403 }
        );
      }
    }

    // If action = "verify", just return booking info for admin review
    if (!action || action === "verify") {
      return NextResponse.json(
        {
          booking: { ...booking, station: stationData },
          message: "Booking found. Review details before confirming.",
        },
        { status: 200 }
      );
    }

    // If action = "confirm", transition the booking status
    if (action === "confirm") {
      const liveBooking = await Booking.findById(parsed.bookingId);
      if (!liveBooking) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const validTransitions: Record<string, string> = {
        pending: "confirmed",
        confirmed: "active",
      };

      const nextStatus = validTransitions[liveBooking.status];
      if (!nextStatus) {
        return NextResponse.json(
          {
            error: `Booking is "${liveBooking.status}" — cannot advance further. ${
              liveBooking.status === "active"
                ? "Use the admin panel to mark it as completed."
                : ""
            }`,
          },
          { status: 400 }
        );
      }

      liveBooking.status = nextStatus as "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no-show";
      await liveBooking.save();

      // If activating, mark port as occupied for DB-based stations
      if (nextStatus === "active" && !sid.startsWith("station-")) {
        await Station.updateOne(
          { _id: booking.stationId, "chargingPorts._id": booking.portId },
          {
            $set: {
              "chargingPorts.$.status": "occupied",
              "chargingPorts.$.currentBookingId": liveBooking._id,
            },
          }
        );
      }

      const updatedBooking = await Booking.findById(parsed.bookingId).lean();

      return NextResponse.json(
        {
          booking: { ...updatedBooking, station: stationData },
          message: `Booking ${nextStatus === "confirmed" ? "confirmed" : "activated"} successfully!`,
          previousStatus: booking.status,
          newStatus: nextStatus,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'verify' or 'confirm'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing QR scan:", error);
    return NextResponse.json(
      { error: "Failed to process QR code" },
      { status: 500 }
    );
  }
}
