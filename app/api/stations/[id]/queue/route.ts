import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Queue from "@/lib/models/Queue";
import { broadcastQueueUpdate } from "@/lib/realtime";

/** GET — queue status for a station and the current user's position */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stationId } = await params;
    const { userId } = await auth();

    await dbConnect();

    const queue = await Queue.find({
      stationId,
      status: { $in: ["waiting", "notified"] },
    })
      .sort({ position: 1 })
      .lean();

    const userEntry = userId
      ? queue.find((q) => q.userId === userId)
      : null;

    const userIdx = userId
      ? queue.findIndex((q) => q.userId === userId)
      : -1;

    return NextResponse.json({
      queue: queue.map((q, i) => ({
        position: i + 1,
        userName: q.userName,
        status: q.status,
        joinedAt: q.joinedAt,
      })),
      totalInQueue: queue.length,
      userPosition: userIdx >= 0 ? userIdx + 1 : null,
      userStatus: userEntry?.status || null,
      userExpiresAt: userEntry?.expiresAt || null,
      estimatedWaitMin: userIdx >= 0 ? (userIdx + 1) * 30 : null,
    });
  } catch (error) {
    console.error("Queue GET error:", error);
    return NextResponse.json(
      { error: "Failed to get queue" },
      { status: 500 }
    );
  }
}

/** POST — join the queue */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: stationId } = await params;
    const user = await currentUser();

    await dbConnect();

    // Prevent duplicate entries
    const existing = await Queue.findOne({
      userId,
      stationId,
      status: { $in: ["waiting", "notified"] },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Already in queue", position: existing.position },
        { status: 409 }
      );
    }

    // Get next position
    const lastEntry = await Queue.findOne({
      stationId,
      status: { $in: ["waiting", "notified"] },
    })
      .sort({ position: -1 })
      .lean();

    const position = (lastEntry?.position ?? 0) + 1;

    const entry = await Queue.create({
      userId,
      userName: user?.firstName || "User",
      stationId,
      position,
      status: "waiting",
      joinedAt: new Date(),
    });

    broadcastQueueUpdate({
      stationId,
      userId,
      position,
      queueStatus: "waiting",
      estimatedWaitMin: position * 30,
    });

    return NextResponse.json(
      {
        message: "Added to queue",
        position,
        estimatedWaitMin: position * 30,
        queueEntryId: entry._id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Queue POST error:", error);
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    );
  }
}

/** DELETE — leave the queue */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: stationId } = await params;
    await dbConnect();

    await Queue.findOneAndUpdate(
      { userId, stationId, status: { $in: ["waiting", "notified"] } },
      { $set: { status: "completed" } }
    );

    // Recalculate positions for remaining queue members
    const remaining = await Queue.find({
      stationId,
      status: "waiting",
    }).sort({ position: 1 });

    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i + 1;
      await remaining[i].save();

      broadcastQueueUpdate({
        stationId,
        userId: remaining[i].userId,
        position: i + 1,
        queueStatus: "waiting",
        estimatedWaitMin: (i + 1) * 30,
      });
    }

    return NextResponse.json({ message: "Left queue" });
  } catch (error) {
    console.error("Queue DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to leave queue" },
      { status: 500 }
    );
  }
}
