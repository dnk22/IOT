# IoT Smart Room

IoT Smart Room is a shared ESP32, backend, and web codebase for the BTL and final essay.

Architecture: ESP32 <-> MQTT <-> HiveMQ Cloud <-> Node.js/TypeScript backend -> SQLite -> REST/WebSocket -> React frontend.

- BTL scope: DHT22 and LDR telemetry over MQTT, backend storage, and web visualization at `/btl`.
- Final essay scope: the BTL foundation extended with OLED, relay, fan, buzzer, manual control, bidirectional MQTT commands, backend data processing, smoothing, and device-side Automation.
- Automation rules are stored in SQLite, synchronized to ESP32 with versioned MQTT configuration and ACKs, persisted in NVS, and evaluated locally so they keep working while the backend is unavailable.
- Manual commands override Automation per actuator; there is no global MANUAL/AUTOMATIC mode. ESP32-reported relay state and control source remain the source of truth.
- Device presence uses retained MQTT availability at `iot/esp32_01/availability`; ESP32 publishes `online` after connection and configures retained `offline` as its Last Will. The dashboard separately reports ESP32 presence and the backend MQTT connection.

## Automation contract

- REST: `GET /api/automation`, `GET /api/automation/capabilities`, `PATCH /api/automation/enabled`, CRUD/toggle under `/api/automation/rules`, and `POST /api/control/resume-automation` with `{ "actuator": "FAN" | "BUZZER" }`.
- Desired snapshots are retained at `iot/<deviceId>/config` (QoS 1). ESP32 ACKs at `iot/<deviceId>/config/ack`; backend sync is `PENDING`, `SYNCED`, or `ERROR` and only becomes `SYNCED` after ACK/status confirms the desired version.
- ESP32 persists the last valid full snapshot in Preferences namespace `automation`, key `config`. Older versions are rejected; an identical current version is ACKed idempotently; a different snapshot using the current version is rejected.
- Rule runtime states are `DISABLED`, `INACTIVE`, `ACTIVE`, and `RELEASING`. A true condition claims immediately; a false/invalid condition retains the claim for 5 seconds before release. Newest `createdSequence` wins per actuator.
- Manual commands set a runtime-only override independently for Fan/Buzzer. Resume Automation clears only that actuator's override; active Automation claims then take effect immediately, otherwise the saved manual base state remains.
