import { EventEmitter } from "events";

// ── Event type definitions ──

export interface PortUpdateEvent {
  type: "port-update";
  stationId: string;
  portId: string;
  status: string;
  event: string;
  timestamp: string;
}

export interface UserNotificationEvent {
  type: "notification";
  userId: string;
  notification: {
    _id: string;
    title: string;
    message: string;
    notificationType: string;
    stationId?: string;
    actionUrl?: string;
  };
}

export interface QueueUpdateEvent {
  type: "queue-update";
  stationId: string;
  userId: string;
  position: number;
  queueStatus: string;
  estimatedWaitMin: number;
}

export type RealtimeEvent =
  | PortUpdateEvent
  | UserNotificationEvent
  | QueueUpdateEvent;

// ── Singleton emitter (survives Next.js HMR) ──

const globalForRealtime = globalThis as unknown as {
  __realtimeEmitter: EventEmitter | undefined;
};

function createEmitter(): EventEmitter {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);
  return emitter;
}

export const realtimeEmitter: EventEmitter =
  globalForRealtime.__realtimeEmitter ?? createEmitter();

if (!globalForRealtime.__realtimeEmitter) {
  globalForRealtime.__realtimeEmitter = realtimeEmitter;
}

// ── File-based port status store (works across Next.js dev workers) ──

import fs from "fs";
import path from "path";

const PORT_STATUS_FILE = path.join(process.cwd(), ".port-status.json");

function readPortStatusFile(): Record<string, Record<string, string>> {
  try {
    if (fs.existsSync(PORT_STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(PORT_STATUS_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function writePortStatusFile(
  data: Record<string, Record<string, string>>
): void {
  try {
    fs.writeFileSync(PORT_STATUS_FILE, JSON.stringify(data), "utf-8");
  } catch { /* ignore */ }
}

export function setPortStatus(
  stationId: string,
  portId: string,
  status: string
): void {
  const store = readPortStatusFile();
  if (!store[stationId]) store[stationId] = {};
  store[stationId][portId] = status;
  writePortStatusFile(store);
}

export function getPortStatuses(
  stationId: string
): Record<string, string> {
  const store = readPortStatusFile();
  return store[stationId] || {};
}

// ── Helper broadcasters ──

export function broadcastPortUpdate(
  event: Omit<PortUpdateEvent, "type">
): void {
  // Store latest status in global store for polling fallback
  setPortStatus(event.stationId, event.portId, event.status);
  realtimeEmitter.emit("port-update", { ...event, type: "port-update" });
}

export function broadcastNotification(
  event: Omit<UserNotificationEvent, "type">
): void {
  realtimeEmitter.emit("notification", { ...event, type: "notification" });
}

export function broadcastQueueUpdate(
  event: Omit<QueueUpdateEvent, "type">
): void {
  realtimeEmitter.emit("queue-update", { ...event, type: "queue-update" });
}
