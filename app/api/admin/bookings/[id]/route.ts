import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Booking from "@/lib/models/Booking";
import Station from "@/lib/models/Station";
import { verifyAdminRole } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyAdminRole(userId);
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Station admins can only manage bookings for their own stations
    if (user.role === "admin") {
      const sid = String(booking.stationId);
      if (!sid.startsWith("station-")) {
        const station = await Station.findById(booking.stationId).select("adminId").lean();
        if (!station || station.adminId !== userId) {
          return NextResponse.json(
            { error: "You can only manage bookings for your own stations" },
            { status: 403 }
          );
        }
      }
    }

    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "active", "completed", "cancelled"],
      confirmed: ["active", "completed", "cancelled", "no-show"],
      active: ["completed"],
      completed: [],
      cancelled: [],
      "no-show": [],
    };

    if (status && !validTransitions[booking.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from "${booking.status}" to "${status}"` },
        { status: 400 }
      );
    }

    if (status) {
      booking.status = status;
    }

    // Release port if booking is completed/cancelled
    const sid = String(booking.stationId);
    if (
      (status === "completed" || status === "cancelled") &&
      !sid.startsWith("station-")
    ) {
      const isOid = /^[a-f\d]{24}$/i.test(String(booking.portId));
      const portFilter = isOid
        ? { "chargingPorts._id": booking.portId }
        : { "chargingPorts.portNumber": booking.portId };
      await Station.updateOne(
        { _id: booking.stationId, ...portFilter } as Record<string, unknown>,
        {
          $set: { "chargingPorts.$.status": "available" },
          $unset: { "chargingPorts.$.currentBookingId": "" },
        }
      );
    }

    await booking.save();

    return NextResponse.json({ booking }, { status: 200 });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}
