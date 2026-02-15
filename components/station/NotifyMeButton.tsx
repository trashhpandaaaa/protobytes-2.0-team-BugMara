"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotifyMeButtonProps {
  stationId: string;
  hasAvailablePorts: boolean;
}

export function NotifyMeButton({
  stationId,
  hasAvailablePorts,
}: NotifyMeButtonProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/stations/${stationId}/subscribe`);
        if (res.ok) {
          const data = await res.json();
          setSubscribed(data.subscribed);
        }
      } catch {
        /* ignore */
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [stationId]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        const res = await fetch(`/api/stations/${stationId}/subscribe`, {
          method: "DELETE",
        });
        if (res.ok) setSubscribed(false);
      } else {
        const res = await fetch(`/api/stations/${stationId}/subscribe`, {
          method: "POST",
        });
        if (res.ok) setSubscribed(true);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  // Hide when ports are available or still loading initial state
  if (hasAvailablePorts || checking) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
        subscribed
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <>
          <BellOff className="h-4 w-4" />
          Stop Notifications
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Notify Me When Free
        </>
      )}
    </button>
  );
}
