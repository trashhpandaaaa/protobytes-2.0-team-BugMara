"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Clock, Loader2, LogOut, Trophy, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueData {
  totalInQueue: number;
  userPosition: number | null;
  userStatus: string | null;
  userExpiresAt: string | null;
  estimatedWaitMin: number | null;
}

interface QueueManagerProps {
  stationId: string;
  hasAvailablePorts: boolean;
}

export function QueueManager({
  stationId,
  hasAvailablePorts,
}: QueueManagerProps) {
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/stations/${stationId}/queue`);
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Listen for SSE queue updates
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/sse/user");
      es.addEventListener("queue-update", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.stationId === stationId) {
            setQueueData((prev) =>
              prev
                ? {
                    ...prev,
                    userPosition: data.position,
                    userStatus: data.queueStatus,
                    estimatedWaitMin: data.estimatedWaitMin,
                  }
                : prev
            );
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* SSE not available */
    }
    return () => es?.close();
  }, [stationId]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/stations/${stationId}/queue`, {
        method: "POST",
      });
      if (res.ok || res.status === 409) {
        await fetchQueue();
      }
    } catch {
      /* ignore */
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await fetch(`/api/stations/${stationId}/queue`, { method: "DELETE" });
      await fetchQueue();
    } catch {
      /* ignore */
    } finally {
      setLeaving(false);
    }
  };

  if (hasAvailablePorts || loading) return null;

  const isInQueue = queueData?.userPosition != null;
  const isNotified = queueData?.userStatus === "notified";

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
          <Users className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Virtual Queue
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {queueData?.totalInQueue || 0} people waiting
          </p>
        </div>
      </div>

      {isNotified ? (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">
              It&apos;s Your Turn!
            </span>
          </div>
          <p className="text-xs text-emerald-300/80">
            A port is now available. Book within 5 minutes before your spot
            expires.
          </p>
          {queueData?.userExpiresAt && (
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
              <Timer className="h-3 w-3" />
              <CountdownTimer expiresAt={queueData.userExpiresAt} />
            </div>
          )}
        </div>
      ) : isInQueue ? (
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Your Position
            </span>
            <span className="text-2xl font-bold text-purple-400">
              #{queueData?.userPosition}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Estimated wait: ~{queueData?.estimatedWaitMin || 30} min
          </div>
        </div>
      ) : null}

      {isInQueue ? (
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          {leaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Leave Queue
        </button>
      ) : (
        <button
          onClick={handleJoin}
          disabled={joining}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500/15 py-2.5 text-sm font-semibold text-purple-400 border border-purple-500/30 transition-colors hover:bg-purple-500/25"
        >
          {joining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          Join Queue
        </button>
      )}
    </div>
  );
}

/* ── Countdown Timer ── */
function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${min}:${sec.toString().padStart(2, "0")} remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span>{timeLeft}</span>;
}
