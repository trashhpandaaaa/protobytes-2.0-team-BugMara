import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Station from "@/lib/models/Station";
import Notification from "@/lib/models/Notification";
import PortSubscription from "@/lib/models/PortSubscription";
import Queue from "@/lib/models/Queue";
import {
  broadcastPortUpdate,
  broadcastNotification,
  broadcastQueueUpdate,
} from "@/lib/realtime";

const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || "esp32-default-key";

/**
 * POST /api/hardware/port-update
 *
 * Called by ESP32 hardware to report port status changes.
 * Broadcasts SSE events, updates DB, notifies subscribers, processes queue.
 */
export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== HARDWARE_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { stationId, portId, status, event: eventName } = body;

    if (!stationId || !portId || !status) {
      return NextResponse.json(
        { error: "Missing stationId, portId, or status" },
        { status: 400 }
      );
    }

    // 1. Broadcast real-time SSE update immediately
    broadcastPortUpdate({
      stationId,
      portId,
      status,
      event: eventName || "status_change",
      timestamp: new Date().toISOString(),
    });

    // 2. Update DB station (skip for file-based stations)
    if (!stationId.startsWith("station-")) {
      try {
        await dbConnect();
        await Station.findOneAndUpdate(
          { _id: stationId, "chargingPorts._id": portId },
          { $set: { "chargingPorts.$.status": status } }
        );
      } catch {
        // DB update failed — SSE broadcast already sent
      }
    }

    // 3. If port became available, notify subscribers and process queue
    if (status === "available") {
      await handlePortAvailable(stationId, portId);
    }

    return NextResponse.json({
      success: true,
      message: `Port ${portId} status → ${status}`,
    });
  } catch (error) {
    console.error("Hardware port update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── When a port becomes available, fire notifications and advance the queue ──

async function handlePortAvailable(stationId: string, portId: string) {
  try {
    await dbConnect();

    // Resolve station name for human-readable notifications
    let stationName = stationId;
    if (!stationId.startsWith("station-")) {
      const station = await Station.findById(stationId)
        .select("name")
        .lean();
      if (station) stationName = station.name;
    }

    // ── Notify "Notify Me When Free" subscribers ──
    const subscribers = await PortSubscription.find({
      stationId,
      active: true,
    }).lean();

    for (const sub of subscribers) {
      const notification = await Notification.create({
        userId: sub.userId,
        type: "port_available",
        title: "Port Available! ⚡",
        message: `A charging port is now available at ${stationName}. Book now before it's taken!`,
        stationId,
        stationName,
        portId,
        actionUrl: `/booking/${stationId}`,
      });

      broadcastNotification({
        userId: sub.userId,
        notification: {
          _id: notification._id.toString(),
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          stationId,
          actionUrl: notification.actionUrl,
        },
      });
    }

    // Deactivate subscriptions (one‑time alert)
    if (subscribers.length > 0) {
      await PortSubscription.updateMany(
        { stationId, active: true },
        { $set: { active: false } }
      );
    }

    // ── Process virtual queue — notify first waiting person ──
    const nextInQueue = await Queue.findOneAndUpdate(
      { stationId, status: "waiting" },
      {
        $set: {
          status: "notified",
          notifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min to book
        },
      },
      { sort: { position: 1 }, new: true }
    );

    if (nextInQueue) {
      const notification = await Notification.create({
        userId: nextInQueue.userId,
        type: "queue_turn",
        title: "It's Your Turn! 🎉",
        message: `A port is now available at ${stationName}. You have 5 minutes to book before your spot expires.`,
        stationId,
        stationName,
        portId,
        actionUrl: `/booking/${stationId}`,
      });

      broadcastNotification({
        userId: nextInQueue.userId,
        notification: {
          _id: notification._id.toString(),
          title: notification.title,
          message: notification.message,
          notificationType: notification.type,
          stationId,
          actionUrl: notification.actionUrl,
        },
      });

      broadcastQueueUpdate({
        stationId,
        userId: nextInQueue.userId,
        position: nextInQueue.position,
        queueStatus: "notified",
        estimatedWaitMin: 0,
      });

      // Broadcast updated positions to everyone still waiting
      const remaining = await Queue.find({
        stationId,
        status: "waiting",
      }).sort({ position: 1 });

      for (let i = 0; i < remaining.length; i++) {
        broadcastQueueUpdate({
          stationId,
          userId: remaining[i].userId,
          position: i + 1,
          queueStatus: "waiting",
          estimatedWaitMin: (i + 1) * 30,
        });
      }
    }
  } catch (error) {
    console.error("Error handling port available:", error);
  }
}
