import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const autoCreate = url.searchParams.get("autoCreate");
    const roleParam = url.searchParams.get("role");

    let user = await User.findOne({ clerkId: userId })
      .populate("favoriteStations", "name location photos rating")
      .lean();

    // Auto-create user in MongoDB after Clerk sign-up redirect
    if (!user && autoCreate === "true") {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const email =
        clerkUser.emailAddresses?.[0]?.emailAddress || "";
      const name =
        `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
        "User";

      // Use the role selected during sign-up (passed via query param)
      const validRoles = ["user", "admin", "superadmin"] as const;
      const role: "user" | "admin" | "superadmin" =
        validRoles.includes(roleParam as typeof validRoles[number])
          ? (roleParam as "user" | "admin" | "superadmin")
          : "user";

      const newUser = await User.create({
        clerkId: userId,
        email,
        name,
        role,
        favoriteStations: [],
      });

      const redirectUrl =
        role === "admin" || role === "superadmin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    if (!user && !autoCreate) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If autoCreate was set but user already exists, redirect
    if (user && autoCreate === "true") {
      const redirectUrl =
        user.role === "admin" || user.role === "superadmin"
          ? "/admin"
          : "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
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

    const body = await req.json();
    const { email, name, phone, vehicleInfo } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "email and name are required" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ clerkId: userId });

    if (existingUser) {
      existingUser.email = email;
      existingUser.name = name;
      if (phone !== undefined) existingUser.phone = phone;
      if (vehicleInfo !== undefined) existingUser.vehicleInfo = vehicleInfo;
      await existingUser.save();

      return NextResponse.json({ user: existingUser }, { status: 200 });
    }

    const user = await User.create({
      clerkId: userId,
      email,
      name,
      phone: phone || undefined,
      vehicleInfo: vehicleInfo || undefined,
      role: "user",
      favoriteStations: [],
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return NextResponse.json(
      { error: "Failed to create/update user" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json();
    const { name, phone, vehicleInfo } = body;

    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (vehicleInfo !== undefined) user.vehicleInfo = vehicleInfo;

    await user.save();

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
