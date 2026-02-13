import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import { loadStationFromFile } from "@/lib/stations";
import { calculateETA, getStationCoordinates } from "@/lib/eta";
import Booking from "@/lib/models/Booking";
import Station from "@/lib/models/Station";
import User from "@/lib/models/User";
import QRCode from "qrcode";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const filter: Record<string, unknown> = { userId };
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich bookings with station data
    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const sid = String(booking.stationId);
        if (sid.startsWith("station-")) {
          const stationData = loadStationFromFile(sid);
          return { ...booking, stationId: stationData || sid };
        }
        // For DB-based bookings, populate station data in a single query
        const populated = await Booking.findById(booking._id)
          .populate("stationId", "name location chargingPorts pricing photos")
          .lean();
        return populated || booking;
      })
    );

    return NextResponse.json({ bookings: enriched }, { status: 200 });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
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

    await dbConnect();

    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      // Auto-create user from Clerk data
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      user = await User.create({
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        role: "user",
        favoriteStations: [],
      });
    }

    const body = await req.json();
    const {
      stationId,
      portId,
      startTime,
      estimatedDuration,
      userLocation,
    } = body;

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

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid startTime format" },
        { status: 400 }
      );
    }

    const isFileBased = stationId.startsWith("station-");
    let stationData;
    let depositAmount: number;

    if (isFileBased) {
      stationData = loadStationFromFile(stationId);
      if (!stationData) {
        return NextResponse.json(
          { error: "Station not found" },
          { status: 404 }
        );
      }
      depositAmount = stationData.pricing.depositAmount;
    } else {
      const station = await Station.findById(stationId);
      if (!station) {
        return NextResponse.json(
          { error: "Station not found" },
          { status: 404 }
        );
      }

      const port = station.chargingPorts.find(
        (p) => p._id?.toString() === portId || p.portNumber === portId
      );
      if (!port) {
        return NextResponse.json(
          { error: "Port not found" },
          { status: 404 }
        );
      }

      depositAmount = station.pricing.depositAmount;
    }

    const start = startDate;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // Check for overlapping bookings
    const overlapping = await Booking.findOne({
      stationId,
      portId,
      status: { $in: ["pending", "confirmed", "active"] },
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });

    if (overlapping) {
      return NextResponse.json(
        { error: "Time slot is not available for this port" },
        { status: 409 }
      );
    }

    // Calculate ETA if user shared their location
    let etaData = undefined;
    let userLocationData = undefined;
    if (userLocation && userLocation.lat && userLocation.lng) {
      userLocationData = { lat: userLocation.lat, lng: userLocation.lng };
      const stationCoords = await getStationCoordinates(stationId);
      if (stationCoords) {
        const eta = await calculateETA(userLocationData, stationCoords);
        if (eta) {
          etaData = eta;
        }
      }
    }

    const booking = await Booking.create({
      userId,
      userName: user.name,
      userEmail: user.email,
      stationId,
      portId,
      startTime: start,
      estimatedDuration: durationMinutes,
      endTime: end,
      status: "pending",
      deposit: {
        amount: depositAmount,
        refunded: false,
      },
      ...(userLocationData && { userLocation: userLocationData }),
      ...(etaData && { eta: etaData }),
    });

    const qrData = JSON.stringify({
      bookingId: booking._id,
      stationId,
      portId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });

    const qrCode = await QRCode.toDataURL(qrData);
    booking.qrCode = qrCode;
    await booking.save();

    // Update port status only for DB-based stations
    if (!isFileBased) {
      // Try matching by _id first, then fall back to portNumber
      const updateResult = await Station.updateOne(
        { _id: stationId, "chargingPorts._id": portId },
        {
          $set: {
            "chargingPorts.$.status": "reserved",
            "chargingPorts.$.currentBookingId": booking._id,
          },
        }
      );
      if (updateResult.modifiedCount === 0) {
        await Station.updateOne(
          { _id: stationId, "chargingPorts.portNumber": portId },
          {
            $set: {
              "chargingPorts.$.status": "reserved",
              "chargingPorts.$.currentBookingId": booking._id,
            },
          }
        );
      }
    }

    const result = await Booking.findById(booking._id).lean();

    return NextResponse.json({ booking: result }, { status: 201 });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
