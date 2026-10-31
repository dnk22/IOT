import "dotenv/config";

import { resolve } from "node:path";

export interface AppConfig {
  port: number;
  mqttHost: string;
  mqttPort: number;
  mqttUsername: string;
  mqttPassword: string;
  mqttClientId: string;
  deviceId: string;
  deviceOfflineTimeoutMs: number;
  maxTelemetryRows: number;
  databasePath: string;
}

function requiredString(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const databasePath =
    process.env.DATABASE_PATH?.trim() || "../database/iot-smart-room.db";
  const deviceId = process.env.DEVICE_ID?.trim() || "esp32_01";
  const mqttClientId =
    process.env.MQTT_CLIENT_ID?.trim() || "iot-smart-room-backend";

  if (mqttClientId === `${deviceId}-client`) {
    throw new Error("MQTT_CLIENT_ID must differ from the ESP32 client ID");
  }

  return {
    port: positiveInteger("PORT", 3000),
    mqttHost: requiredString("MQTT_HOST"),
    mqttPort: positiveInteger("MQTT_PORT", 8883),
    mqttUsername: requiredString("MQTT_USERNAME"),
    mqttPassword: requiredString("MQTT_PASSWORD"),
    mqttClientId,
    deviceId,
    deviceOfflineTimeoutMs: positiveInteger("DEVICE_OFFLINE_TIMEOUT_MS", 15_000),
    maxTelemetryRows: positiveInteger("MAX_TELEMETRY_ROWS", 10_000),
    databasePath: resolve(process.cwd(), databasePath),
  };
}
