"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  stationId?: string;
  stationName?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

/**
 * Real-time notification system.
 * Fetches existing notifications on mount then subscribes to SSE for live updates.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch existing notifications ──
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Connect to user-scoped SSE ──
  const connect = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource("/api/sse/user");
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.addEventListener("notification", (e) => {
      try {
        const data = JSON.parse(e.data);
        const notif = data.notification;
        if (notif) {
          setNotifications((prev) => [
            {
              _id: notif._id,
              type: notif.notificationType,
              title: notif.title,
              message: notif.message,
              stationId: notif.stationId,
              actionUrl: notif.actionUrl,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        /* ignore */
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      reconnectRef.current = setTimeout(connect, 5000);
    };
  }, []);

  useEffect(() => {
    fetchNotifications();
    connect();

    return () => {
      eventSourceRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [fetchNotifications, connect]);

  // ── Mark as read ──
  const markAsRead = useCallback(async (ids?: string[]) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ids ? { notificationIds: ids } : { markAllRead: true }
        ),
      });

      if (ids) {
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n._id) ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - ids.length));
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    refresh: fetchNotifications,
  };
}
