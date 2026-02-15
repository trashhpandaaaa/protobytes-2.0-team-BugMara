import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import PortSubscription from "@/lib/models/PortSubscription";

/** GET — check current subscription status */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ subscribed: false });

    const { id: stationId } = await params;
    await dbConnect();

    const sub = await PortSubscription.findOne({
      userId,
      stationId,
      active: true,
    }).lean();

    return NextResponse.json({ subscribed: !!sub });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}

/** POST — subscribe to "notify me when a port is free" */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: stationId } = await params;
    await dbConnect();

    await PortSubscription.findOneAndUpdate(
      { userId, stationId },
      { $set: { active: true } },
      { upsert: true }
    );

    return NextResponse.json({
      subscribed: true,
      message: "You'll be notified when a port is available",
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe" },
      { status: 500 }
    );
  }
}

/** DELETE — unsubscribe */
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

    await PortSubscription.findOneAndUpdate(
      { userId, stationId },
      { $set: { active: false } }
    );

    return NextResponse.json({ subscribed: false });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
