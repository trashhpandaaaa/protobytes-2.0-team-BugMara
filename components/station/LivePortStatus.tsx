"use client";

import { useState, useEffect, useRef } from "react";
import { cn, getConnectorLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Zap, Wifi, WifiOff } from "lucide-react";
import type { ChargingPort } from "@/types";

const statusConfig: Record<
  string,
  { label: string; variant: "success" | "danger" | "warning" | "default" }
> = {
  available: { label: "Available", variant: "success" },
  occupied: { label: "Occupied", variant: "danger" },
  reserved: { label: "Reserved", variant: "warning" },
  maintenance: { label: "Maintenance", variant: "default" },
};

interface LivePortStatusProps {
  stationId: string;
  initialPorts: ChargingPort[];
}

export function LivePortStatus({
  stationId,
  initialPorts,
}: LivePortStatusProps) {
  const [ports, setPorts] = useState<ChargingPort[]>(initialPorts);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for hardware-reported port statuses every 2s
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/stations/${stationId}/port-status`);
        if (!active) return;
        if (!res.ok) return;
        const data: Record<string, string> = await res.json();
        setIsConnected(true);

        if (Object.keys(data).length === 0) return;

        setPorts((prev) => {
          let changed = false;
          const next = prev.map((port) => {
            const key = port._id ?? port.portNumber ?? "";
            const newStatus = data[key];
            if (newStatus && newStatus !== port.status) {
              changed = true;
              return { ...port, status: newStatus as ChargingPort["status"] };
            }
            return port;
          });
          if (changed) {
            setLastUpdate(new Date().toISOString());
            return next;
          }
          return prev;
        });
      } catch {
        if (active) setIsConnected(false);
      }
    };

    // Immediate first poll
    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stationId]);

  const availablePorts = ports.filter((p) => p.status === "available").length;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-card-foreground">
          <Zap className="h-5 w-5 text-primary" />
          Charging Ports
          <span className="text-sm font-normal text-muted-foreground">
            ({availablePorts}/{ports.length} available)
          </span>
        </h2>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Updated {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              isConnected
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-yellow-500/10 text-yellow-400"
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                LIVE
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Reconnecting…
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ports.map((port) => {
          const config = statusConfig[port.status] || statusConfig.maintenance;
          return (
            <div
              key={port._id || port.portNumber}
              className={cn(
                "rounded-lg border p-4 transition-all duration-300",
                port.status === "available"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : port.status === "occupied"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {port.portNumber}
                </span>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {getConnectorLabel(port.connectorType)}
                </span>
                <span>{port.powerOutput}</span>
                <span>{port.chargerType}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
