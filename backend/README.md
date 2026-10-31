# IoT Smart Room Backend

The backend subscribes to the single ESP32 through HiveMQ Cloud, validates MQTT payloads, calculates EMA values, persists raw and processed telemetry in SQLite, and delivers frontend data through REST and WebSocket. It also owns the desired Automation configuration and synchronizes versioned rules to ESP32.

## Configuration

Copy `.env.example` to `.env` and configure:

- `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- `MQTT_CLIENT_ID` (must differ from the ESP32 client ID)
- `DEVICE_ID` (defaults to `esp32_01`)
- `DEVICE_OFFLINE_TIMEOUT_MS` (defaults to `15000`, three telemetry intervals)
- `PORT`
- `DATABASE_PATH`

MQTT always uses `mqtts` with Node.js certificate verification enabled. Secrets are never logged.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run verify
npm start
```

The default SQLite file is `../database/iot-smart-room.db`, relative to `backend/`.

## Interfaces

REST endpoints:

- `GET /api/health`
- `GET /api/telemetry/latest`
- `GET /api/telemetry/history?from=&to=&limit=`
- `GET /api/status`
- `POST /api/control` with `target: "FAN" | "BUZZER"` and the current `fanOn`/`buzzerOn` state snapshot
- `GET /api/automation`
- `POST /api/automation/rules`
- `PUT /api/automation/rules/:id`
- `DELETE /api/automation/rules/:id`
- `PATCH /api/automation/rules/:id/enabled`
- `PATCH /api/automation/enabled`

Latest telemetry and status return HTTP 404 until data exists. History returns `{ "items": [] }` when empty.

WebSocket is available at `/ws` and broadcasts `telemetry`, `status`, and `automation` messages after successful persistence or configuration-state changes.

MQTT subscriptions include:

- `iot/esp32_01/availability` (`online` / `offline`, retained)
- `iot/esp32_01/telemetry`
- `iot/esp32_01/status`
- `iot/esp32_01/command/ack`
- `iot/esp32_01/config/ack`

The current Automation configuration is published retained with QoS 1 to `iot/esp32_01/config`. The ESP32 validates and persists it, then acknowledges the applied version on `iot/esp32_01/config/ack`.

`GET /api/status` returns the computed `presence` (`ONLINE`, `OFFLINE`, or `UNKNOWN`) and `mqttConnected`. Retained availability is primary; valid device messages refresh `lastSeenAtMs`, and the configured timeout provides a stale-device fallback. When the backend MQTT client is disconnected, presence is always `UNKNOWN` because the backend cannot observe the broker reliably.

The device ID remains in MQTT and SQLite records, while REST and WebSocket intentionally expose a single-device view without device selection.
