import { auth } from "@clerk/nextjs/server";
import {
  realtimeEmitter,
  type UserNotificationEvent,
  type QueueUpdateEvent,
} from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const connectMsg = JSON.stringify({
        type: "connected",
        userId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`data: ${connectMsg}\n\n`));

      const notifListener = (event: UserNotificationEvent) => {
        if (closed || event.userId !== userId) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: notification\ndata: ${JSON.stringify(event)}\n\n`
            )
          );
        } catch {
          closed = true;
        }
      };

      const queueListener = (event: QueueUpdateEvent) => {
        if (closed || event.userId !== userId) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: queue-update\ndata: ${JSON.stringify(event)}\n\n`
            )
          );
        } catch {
          closed = true;
        }
      };

      realtimeEmitter.on("notification", notifListener);
      realtimeEmitter.on("queue-update", queueListener);

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
        realtimeEmitter.off("notification", notifListener);
        realtimeEmitter.off("queue-update", queueListener);
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
