#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const requireFromBackend = createRequire(
  new URL("../../../backend/package.json", import.meta.url),
);
const Database = requireFromBackend("better-sqlite3");

const outputDirectory = resolve(process.argv[2] ?? "testing/embedded/results/runtime-snapshot");
const baseUrl = process.argv[3] ?? "http://127.0.0.1:3000";
const label = process.argv[4] === "after" ? "after" : "before";
const databasePath = resolve(
  process.cwd(),
  process.env.DATABASE_PATH?.trim() || "database/iot-smart-room.db",
);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (["wifiSsid", "ipAddress", "mqttPassword", "mqttUsername"].includes(key)) {
      result[key] = item === null ? null : "[REDACTED]";
    } else {
      result[key] = redact(item);
    }
  }
  return result;
}

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => null);
  return { status: response.status, body: redact(body) };
}

await mkdir(outputDirectory, { recursive: true });
const endpoints = [
  "/api/health",
  "/api/status",
  "/api/telemetry/latest",
  "/api/telemetry/recent?limit=10",
  "/api/automation",
  "/api/automation/capabilities",
];
const api = {};
for (const endpoint of endpoints) {
  try {
    api[endpoint] = await getJson(endpoint);
  } catch (error) {
    api[endpoint] = { error: error instanceof Error ? error.message : String(error) };
  }
}

const database = new Database(databasePath, { fileMustExist: true });
const tableCounts = {};
for (const table of ["sensor_readings", "device_status", "automation_config", "automation_rules"]) {
  tableCounts[table] = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}
const backupFile = `database-${label}.sqlite`;
const backupPath = resolve(outputDirectory, backupFile);
await database.backup(backupPath);
database.close();

const snapshot = {
  capturedAt: new Date().toISOString(),
  databasePath: "[REDACTED_LOCAL_PATH]",
  backupFile,
  tableCounts,
  api,
};
await writeFile(
  resolve(outputDirectory, `runtime-snapshot-${label}.json`),
  `${JSON.stringify(snapshot, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify({ outputDirectory, backupPath, tableCounts }));
