# ESP32 Charging Port Simulator

Simulates a physical EV charging port that communicates with the **Urja Station** backend in real-time. Press a button to cycle through charging states — the web dashboard updates instantly via SSE.

---

## Hardware Requirements

| Component | Notes |
|-----------|-------|
| **ESP32 dev board** | Any ESP32-WROOM-32 or ESP32-S3 board works |
| 3× LEDs + 220Ω resistors | Green, Blue, Red *(optional — built-in LED works alone)* |
| Breadboard + jumper wires | *(optional, for external LEDs)* |

## Wiring Diagram

```
ESP32 Board
┌─────────────┐
│         GPIO 4 ──── 220Ω ──── Green LED ──── GND
│         GPIO 18 ─── 220Ω ──── Blue LED  ──── GND
│         GPIO 5 ──── 220Ω ──── Red LED   ──── GND
│         GPIO 0 ──── BOOT Button (built-in)
│         GPIO 2 ──── Built-in Blue LED
└─────────────┘
```

> **Minimal setup:** No external components needed — the built-in LED (GPIO 2) and BOOT button (GPIO 0) are sufficient for a demo.

## State Machine

```
  ┌─────────────┐    BOOT     ┌────────────────────┐
  │  Available   │───button───▶│  Vehicle Connected  │
  │  (green)     │            │  (blue)             │
  └──────▲───────┘            └────────┬────────────┘
         │                            │ BOOT button
         │                            ▼
  ┌──────┴────────┐           ┌────────────────────┐
  │ Charge Done   │◀──auto────│     Charging        │
  │ (green + red) │  30 sec   │  (green + blue pulse)│
  └───────────────┘           └────────────────────┘
```

Each state change sends an HTTP POST to the backend, which:
1. **Broadcasts** the update via SSE to all connected browsers
2. **Updates** the database (for admin-created stations)
3. **Notifies** "Notify Me" subscribers when a port becomes available
4. **Advances** the virtual queue when a port frees up

## Setup

### 1. Install Arduino IDE (2.0+)

Download from [arduino.cc](https://www.arduino.cc/en/software)

### 2. Add ESP32 Board Support

1. Open **File → Preferences**
2. Add to *Additional Board Manager URLs*:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools → Board Manager** → Search *"ESP32"* → Install **esp32 by Espressif Systems**

### 3. Install ArduinoJson Library

**Tools → Manage Libraries** → Search *"ArduinoJson"* → Install **v7+**

### 4. Configure the Sketch

Open `esp32-station-port.ino` and update:

```cpp
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* SERVER_URL    = "http://192.168.1.100:3000/api/hardware/port-update";
const char* API_KEY       = "esp32-secret-key-change-me";
const char* STATION_ID    = "6789abc...";   // From admin panel
const char* PORT_ID       = "port-1";        // Port ID from the station
```

### 5. Backend `.env` Configuration

Add to your `.env` or `.env.local`:

```env
HARDWARE_API_KEY=esp32-secret-key-change-me
```

> The `API_KEY` in the sketch **must match** `HARDWARE_API_KEY` in `.env`.

### 6. Upload

1. Select your board: **Tools → Board → ESP32 Dev Module**
2. Select the COM port: **Tools → Port → COMx**
3. Click **Upload**

## Usage

### Button Control

Press the **BOOT** button to cycle:

| Press | State | API Status | LED |
|-------|-------|-----------|-----|
| — | Available | `available` | 🟢 Green |
| 1st | Vehicle Connected | `occupied` | 🔵 Blue |
| 2nd | Charging | `occupied` | 🔵💚 Blue pulse + Green |
| 3rd *(or auto after 30s)* | Charge Complete | `available` | 🟢🔴 Green + Red |
| 4th | Available | `available` | 🟢 Green |

### Serial Monitor

Open at **115200 baud** to see live logs:

```
[WiFi] ✓ Connected — IP: 192.168.1.105
[Config] Station : 6789abc...
[Config] Port    : port-1
→ Press BOOT button to cycle charging states
─────────────────────────────────────────────
┌────────────────────────────────────┐
│  State  : Available                │
│  Status : available                │
│  Event  : port_available           │
└────────────────────────────────────┘
[HTTP] → {"stationId":"6789abc...","portId":"port-1","status":"available",...}
[HTTP] ← 200: {"success":true,"message":"Port status updated"}
```

### Demo Mode

For automated demos (e.g., at a hackathon booth), set in the sketch:

```cpp
#define AUTO_DEMO_MODE   true
#define AUTO_CYCLE_MS    10000   // Advance every 10 seconds
```

## How It Works

```
┌──────────┐   HTTP POST    ┌──────────────┐   SSE    ┌─────────────┐
│  ESP32   │───────────────▶│  Next.js API  │────────▶│  Browser    │
│          │  /api/hardware  │              │         │  Dashboard  │
│  Button  │  /port-update   │  EventEmitter│         │  Live Ports │
│  + LEDs  │                │  + MongoDB   │         │  + Queue    │
└──────────┘                └──────────────┘         └─────────────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │  Notify Me   │
                            │  Subscribers │
                            │  + Queue     │
                            └──────────────┘
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| WiFi won't connect | Ensure 2.4 GHz network (ESP32 doesn't support 5 GHz) |
| HTTP errors | Verify `SERVER_URL` is reachable from ESP32's network |
| `401 Unauthorized` | Check `API_KEY` matches `HARDWARE_API_KEY` in `.env` |
| No LED response | Verify GPIO pins match your wiring |
| Upload fails | Hold BOOT button during upload, or check USB driver |
| Port status doesn't update in browser | Ensure SSE endpoint is running, check browser DevTools Network tab |
