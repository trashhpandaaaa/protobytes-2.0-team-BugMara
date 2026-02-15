"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import type { ChargingPort } from "@/types";

interface PortUpdateEvent {
  type: "port-update";
  stationId: string;
  portId: string;
  status: string;
  event: string;
  timestamp: string;
}

/**
 * Subscribe to real-time port status updates for a specific station via SSE.
 * Includes polling fallback every 3s for dev-mode reliability.
 * Returns live port array, connection status, and last update timestamp.
 */
export function useStationSSE(
  stationId: string,
  initialPorts: ChargingPort[]
) {
  const [ports, setPorts] = useState<ChargingPort[]>(initialPorts);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttempts = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling fallback — fetches latest port statuses from the global store
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/stations/${stationId}/port-status`
        );
        if (!res.ok) return;
        const data: Record<string, string> = await res.json();
        if (Object.keys(data).length === 0) return;
        console.log("[SSE Poll] port-status response:", data);
        setPorts((prev) => {
          const next = prev.map((port) => {
            const newStatus = data[port._id ?? ""] || data[port.portNumber ?? ""];
            console.log("[SSE Poll] port", port._id, port.portNumber, "→ match:", newStatus, "current:", port.status);
            if (newStatus && newStatus !== port.status) {
              return { ...port, status: newStatus as ChargingPort["status"] };
            }
            return port;
          });
          return next;
        });
      } catch { /* ignore */ }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stationId]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(
      `/api/sse/station-updates?stationId=${stationId}`
    );
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    es.addEventListener("port-update", (e) => {
      try {
        const data: PortUpdateEvent = JSON.parse(e.data);
        setPorts((prev) =>
          prev.map((port) =>
            port._id === data.portId || port.portNumber === data.portId
              ? {
                  ...port,
                  status: data.status as ChargingPort["status"],
                }
              : port
          )
        );
        setLastUpdate(data.timestamp);
      } catch (err) {
        console.error("Failed to parse SSE port update:", err);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      // Exponential back-off (max 30 s)
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        30000
      );
      reconnectAttempts.current++;
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [stationId]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return { ports, isConnected, lastUpdate };
}
