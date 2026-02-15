"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, X, Check, Users, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useRouter } from "next/navigation";

const typeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  port_available: Zap,
  queue_turn: Users,
  booking_reminder: Clock,
  charging_complete: Check,
  queue_update: Users,
  general: Bell,
};

const typeColors: Record<string, string> = {
  port_available: "bg-emerald-500/10 text-emerald-400",
  queue_turn: "bg-purple-500/10 text-purple-400",
  booking_reminder: "bg-blue-500/10 text-blue-400",
  charging_complete: "bg-amber-500/10 text-amber-400",
  queue_update: "bg-purple-500/10 text-purple-400",
  general: "bg-muted text-muted-foreground",
};

export function NotificationBell() {
  const { notifications, unreadCount, isConnected, markAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {/* SSE connection dot */}
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2 w-2 rounded-full border border-sidebar",
            isConnected ? "bg-emerald-500" : "bg-yellow-500"
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute left-full top-0 ml-2 z-50 w-80 rounded-xl border border-border/50 bg-card shadow-2xl lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:ml-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAsRead()}
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-xs text-muted-foreground">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = typeIcons[notif.type] || Bell;
                const colorClass =
                  typeColors[notif.type] || typeColors.general;

                return (
                  <div
                    key={notif._id}
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer border-b border-border/30 last:border-0",
                      !notif.read && "bg-primary/5"
                    )}
                    onClick={() => {
                      if (!notif.read) markAsRead([notif._id]);
                      if (notif.actionUrl) {
                        setOpen(false);
                        router.push(notif.actionUrl);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        colorClass
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-medium",
                          notif.read
                            ? "text-muted-foreground"
                            : "text-foreground"
                        )}
                      >
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {formatTime(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
