import {
  realtimeEmitter,
  type PortUpdateEvent,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stationId = searchParams.get("stationId");

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectMsg = JSON.stringify({
        type: "connected",
        stationId: stationId || "all",
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`));

      const portListener = (event: PortUpdateEvent) => {
        if (closed) return;
        if (stationId && event.stationId !== stationId) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: port-update\ndata: ${JSON.stringify(event)}\n\n`
            )
          );
        } catch {
          closed = true;
        }
      };

      realtimeEmitter.on("port-update", portListener);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
          cleanup();
        }
      }, 30000);

      function cleanup() {
        realtimeEmitter.off("port-update", portListener);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {}
      }

      req.signal?.addEventListener("abort", () => {
        closed = true;
        cleanup();
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
