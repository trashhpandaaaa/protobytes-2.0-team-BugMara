import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import Notification from "@/lib/models/Notification";

/** GET — retrieve the current user's notifications */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ notifications: [], unreadCount: 0 });

    await dbConnect();

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

/** PATCH — mark notifications as read */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { notificationIds, markAllRead } = body;

    await dbConnect();

    if (markAllRead) {
      await Notification.updateMany(
        { userId, read: false },
        { $set: { read: true } }
      );
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await Notification.updateMany(
        { _id: { $in: notificationIds }, userId },
        { $set: { read: true } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
