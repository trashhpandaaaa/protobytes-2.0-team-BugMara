import { NextResponse } from "next/server";
import { getPortStatuses } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * GET /api/stations/[id]/port-status
 *
 * Returns the latest hardware-reported port statuses for a station.
 * Used as a polling fallback alongside SSE.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const statuses = getPortStatuses(id);
  return NextResponse.json(statuses, {
    headers: { "Cache-Control": "no-store" },
  });
}
