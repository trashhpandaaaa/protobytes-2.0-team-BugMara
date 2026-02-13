import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { loadStationFromFile } from "@/lib/stations";
import Booking from "@/lib/models/Booking";
import Station from "@/lib/models/Station";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { stationId, portId, startTime, estimatedDuration } = body;

    if (!stationId || !portId || !startTime || !estimatedDuration) {
      return NextResponse.json(
        { error: "stationId, portId, startTime, and estimatedDuration are required" },
        { status: 400 }
      );
    }

    // estimatedDuration is in minutes from the frontend
    const durationMinutes = Number(estimatedDuration);
    if (isNaN(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
      return NextResponse.json(
        { error: "estimatedDuration must be between 1 and 1440 minutes" },
        { status: 400 }
      );
    }
    const durationHours = durationMinutes / 60;

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid startTime format" },
        { status: 400 }
      );
    }

    let station;

    if (stationId.startsWith("station-")) {
      // File-based station
      station = loadStationFromFile(stationId);
    } else {
      await dbConnect();
      station = await Station.findById(stationId).lean();
    }

    if (!station) {
      return NextResponse.json(
        { error: "Station not found" },
        { status: 404 }
      );
    }

    const port = station.chargingPorts.find(
      (p: { _id?: unknown; portNumber?: string; status: string }) =>
        String(p._id) === portId || p.portNumber === portId
    );
    if (!port) {
      return NextResponse.json({ error: "Port not found" }, { status: 404 });
    }

    if (port.status === "maintenance") {
      return NextResponse.json(
        { available: false, reason: "Port is under maintenance" },
        { status: 200 }
      );
    }

    const start = startDate;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Only check DB overlaps if station is in DB (not file-based)
    if (!stationId.startsWith("station-")) {
      await dbConnect();
      const overlapping = await Booking.findOne({
        stationId,
        portId,
        status: { $in: ["pending", "confirmed", "active"] },
        $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
      });

      if (overlapping) {
        return NextResponse.json(
          {
            available: false,
            reason: "Time slot overlaps with an existing booking",
            conflictingBooking: {
              startTime: overlapping.startTime,
              endTime: overlapping.endTime,
            },
          },
          { status: 200 }
        );
      }
    }

    const pricing = station.pricing as { perHour: number; depositAmount: number };

    return NextResponse.json(
      {
        available: true,
        port: {
          portNumber: port.portNumber,
          connectorType: port.connectorType,
          powerOutput: port.powerOutput,
          chargerType: port.chargerType,
        },
        requestedSlot: {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationMinutes,
        },
        estimatedCost: {
          perHour: pricing.perHour,
          total: pricing.perHour * durationHours,
          deposit: pricing.depositAmount,
          currency: "NPR",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error checking availability:", error);
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
