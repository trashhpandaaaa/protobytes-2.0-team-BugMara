/*
 * ╔══════════════════════════════════════════════════╗
 * ║   Urja Station — ESP32 Charging Port Simulator   ║
 * ╚══════════════════════════════════════════════════╝
 *
 * Simulates a physical EV charging port that communicates with the
 * Urja Station backend in real-time via HTTP + SSE.
 *
 * Press the BOOT button (GPIO 0) to cycle through charging states:
 *   Available → Vehicle Connected → Charging → Charge Complete → Available
 *
 * LEDs indicate current state:
 *   Green       = Available
 *   Blue        = Vehicle Connected
 *   Blue+Green  = Charging (blue pulses)
 *   Green+Red   = Charge Complete
 *
 * Sends HTTP POST to /api/hardware/port-update on every state change.
 *
 * SETUP:
 *   1. Install ESP32 board support in Arduino IDE
 *   2. Install ArduinoJson library (v7+)
 *   3. Update WiFi credentials and server URL below
 *   4. Set STATION_ID and PORT_ID from your admin panel
 *   5. Upload to ESP32
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ═══════════════════ CONFIGURATION ═══════════════════
// WiFi
const char* WIFI_SSID     = "Red Panda";
const char* WIFI_PASSWORD = "Avocado@8008";

// Urja Station Backend
const char* SERVER_URL    = "http://192.168.18.40:3000/api/hardware/port-update";
const char* API_KEY       = "esp32-secret-key-change-me"; // Must match HARDWARE_API_KEY env var

// Station & Port — "Siddhartha Riverside Resort TATA" (MongoDB), Port P15-1
const char* STATION_ID    = "698fc1f9d37a20005e3076d7";
const char* PORT_ID       = "698fc1f9d37a20005e3076d8";
// ═════════════════════════════════════════════════════

// ─── Pin Definitions ─────────────────────────────────
#define BUTTON_PIN   0   // BOOT button (built-in on most ESP32 boards)
#define LED_BUILTIN  2   // Built-in blue LED
#define LED_GREEN    4   // External green LED (optional)
#define LED_RED      5   // External red LED (optional)
#define LED_BLUE     18  // External blue LED (optional)

// ─── Demo Auto-Cycle Mode ────────────────────────────
// Set to true for automated demos (cycles states automatically)
#define AUTO_DEMO_MODE   false
#define AUTO_CYCLE_MS    10000   // Auto-advance every 10s in demo mode
#define CHARGE_DURATION  30000   // 30s simulated charge time

// ─── State Machine ───────────────────────────────────
enum PortState {
  STATE_AVAILABLE,
  STATE_VEHICLE_CONNECTED,
  STATE_CHARGING,
  STATE_CHARGE_COMPLETE,
  STATE_ERROR
};

const char* stateNames[] = {
  "Available",
  "Vehicle Connected",
  "Charging",
  "Charge Complete",
  "Error"
};

const char* stateStatuses[] = {
  "available",   // → green in UI
  "occupied",    // → red in UI
  "occupied",    // → red in UI (charging)
  "available",   // → green in UI (done, port free)
  "maintenance"  // → grey in UI
};

const char* stateEvents[] = {
  "port_available",
  "vehicle_connected",
  "charging_started",
  "charging_complete",
  "error"
};

// ─── Runtime State ───────────────────────────────────
PortState currentState   = STATE_AVAILABLE;
unsigned long lastChange = 0;
unsigned long lastHeart  = 0;
bool btnDown             = false;

// ═════════════════════════════════════════════════════
//                       SETUP
// ═════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════════════╗");
  Serial.println("║   Urja Station — ESP32 Charging Port Simulator   ║");
  Serial.println("╚══════════════════════════════════════════════════╝");
  Serial.println();

  // GPIO
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);

  // WiFi
  Serial.printf("[WiFi] Connecting to '%s'", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] ✓ Connected — IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] ✗ Failed — running offline (will retry)");
  }

  Serial.println();
  Serial.printf("[Config] Station : %s\n", STATION_ID);
  Serial.printf("[Config] Port    : %s\n", PORT_ID);
  Serial.printf("[Config] Server  : %s\n", SERVER_URL);
  Serial.println();
  Serial.println("→ Press BOOT button to cycle charging states");
  Serial.println("─────────────────────────────────────────────");
  Serial.println();

  updateLEDs();
  sendStatusUpdate();
  printState();
}

// ═════════════════════════════════════════════════════
//                      MAIN LOOP
// ═════════════════════════════════════════════════════
void loop() {
  // ── Button debounce ──
  if (digitalRead(BUTTON_PIN) == LOW && !btnDown) {
    btnDown = true;
    delay(50);
    if (digitalRead(BUTTON_PIN) == LOW) {
      advanceState();
    }
  }
  if (digitalRead(BUTTON_PIN) == HIGH) {
    btnDown = false;
  }

  // ── Auto-complete charging after simulated duration ──
  if (currentState == STATE_CHARGING) {
    if (millis() - lastChange >= CHARGE_DURATION) {
      Serial.println("⚡ Charging complete!");
      currentState = STATE_CHARGE_COMPLETE;
      lastChange = millis();
      updateLEDs();
      sendStatusUpdate();
      printState();
    }
    // Pulse blue LED while charging
    int brightness = (int)(127.5 + 127.5 * sin(millis() / 200.0));
    analogWrite(LED_BLUE, brightness);
    analogWrite(LED_BUILTIN, brightness);
  }

  // ── Auto demo mode ──
  #if AUTO_DEMO_MODE
  if (millis() - lastChange > AUTO_CYCLE_MS) {
    advanceState();
  }
  #endif

  // ── Heartbeat every 60s ──
  if (millis() - lastHeart > 60000) {
    lastHeart = millis();
    sendStatusUpdate();
  }

  // ── WiFi reconnect ──
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnect = 0;
    if (millis() - lastReconnect > 10000) {
      lastReconnect = millis();
      Serial.println("[WiFi] ⚠ Disconnected — reconnecting...");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  delay(50);
}

// ═════════════════════════════════════════════════════
//                   STATE MACHINE
// ═════════════════════════════════════════════════════
void advanceState() {
  switch (currentState) {
    case STATE_AVAILABLE:         currentState = STATE_VEHICLE_CONNECTED; break;
    case STATE_VEHICLE_CONNECTED: currentState = STATE_CHARGING;          break;
    case STATE_CHARGING:          currentState = STATE_CHARGE_COMPLETE;   break;
    case STATE_CHARGE_COMPLETE:   currentState = STATE_AVAILABLE;         break;
    default:                      currentState = STATE_AVAILABLE;         break;
  }

  lastChange = millis();
  updateLEDs();
  sendStatusUpdate();
  printState();
}

// ═════════════════════════════════════════════════════
//                    LED CONTROL
// ═════════════════════════════════════════════════════
void updateLEDs() {
  // Reset all
  digitalWrite(LED_GREEN,   LOW);
  digitalWrite(LED_RED,     LOW);
  digitalWrite(LED_BLUE,    LOW);
  digitalWrite(LED_BUILTIN, LOW);

  switch (currentState) {
    case STATE_AVAILABLE:
      digitalWrite(LED_GREEN, HIGH);
      break;

    case STATE_VEHICLE_CONNECTED:
      digitalWrite(LED_BLUE, HIGH);
      digitalWrite(LED_BUILTIN, HIGH);
      break;

    case STATE_CHARGING:
      // Green steady + blue pulse (pulse handled in loop)
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_BLUE, HIGH);
      digitalWrite(LED_BUILTIN, HIGH);
      break;

    case STATE_CHARGE_COMPLETE:
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, HIGH);
      break;

    case STATE_ERROR:
      digitalWrite(LED_RED, HIGH);
      break;
  }
}

// ═════════════════════════════════════════════════════
//                HTTP STATUS UPDATE
// ═════════════════════════════════════════════════════
void sendStatusUpdate() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] ⚠ Skipped — WiFi not connected");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(5000);

  // Build JSON manually (no ArduinoJson needed)
  String payload = "{";
  payload += "\"stationId\":\"" + String(STATION_ID) + "\",";
  payload += "\"portId\":\"" + String(PORT_ID) + "\",";
  payload += "\"status\":\"" + String(stateStatuses[currentState]) + "\",";
  payload += "\"event\":\"" + String(stateEvents[currentState]) + "\",";
  payload += "\"timestamp\":" + String(millis()) + ",";
  payload += "\"deviceId\":\"" + WiFi.macAddress() + "\"";
  payload += "}";

  Serial.printf("[HTTP] → %s\n", payload.c_str());

  int code = http.POST(payload);

  if (code > 0) {
    String body = http.getString();
    Serial.printf("[HTTP] ← %d: %s\n", code, body.c_str());
  } else {
    Serial.printf("[HTTP] ✗ Error: %s\n", http.errorToString(code).c_str());
  }

  http.end();
}

// ═════════════════════════════════════════════════════
//                 SERIAL DISPLAY
// ═════════════════════════════════════════════════════
void printState() {
  Serial.println("┌────────────────────────────────────┐");
  Serial.printf("│  State  : %-24s  │\n", stateNames[currentState]);
  Serial.printf("│  Status : %-24s  │\n", stateStatuses[currentState]);
  Serial.printf("│  Event  : %-24s  │\n", stateEvents[currentState]);
  Serial.println("└────────────────────────────────────┘");
}
