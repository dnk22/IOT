#!/usr/bin/env node
/** Read-only API/cadence checks with automatic secret redaction. */

import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const output = process.argv[2];
if (!output) throw new Error("Usage: api_readonly_test.mjs <output.json>");
const base = process.env.TEST_API_BASE ?? "http://127.0.0.1:3000/api";

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /ssid|password|username|ipaddress|host/i.test(key) ? "[REDACTED]" : redact(item),
      ]),
    );
  }
  return value;
}

async function get(path) {
  const response = await fetch(`${base}${path}`);
  return { path, status: response.status, body: redact(await response.json()) };
}

const startedAt = new Date().toISOString();
const first = await get("/telemetry/recent?limit=10");
const endpoints = await Promise.all([
  get("/health"),
  get("/status"),
  get("/telemetry/latest"),
  get("/automation"),
  get("/automation/capabilities"),
]);
await delay(6500);
const second = await get("/telemetry/recent?limit=10");

const firstItems = first.body?.items ?? [];
const secondItems = second.body?.items ?? [];
const uniqueTimes = new Set(secondItems.map((item) => item.receivedAtMs));
const newestFirst = secondItems.every(
  (item, index) => index === 0 || secondItems[index - 1].receivedAtMs <= item.receivedAtMs,
);
const newRows = secondItems.filter(
  (item) => !firstItems.some((old) => old.receivedAtMs === item.receivedAtMs),
).length;

const result = {
  startedAt,
  endedAt: new Date().toISOString(),
  endpoints,
  recentCheck: {
    firstStatus: first.status,
    secondStatus: second.status,
    firstCount: firstItems.length,
    secondCount: secondItems.length,
    newRowsIn6500Ms: newRows,
    unique: uniqueTimes.size === secondItems.length,
    chronologicalAscending: newestFirst,
    status:
      first.status === 200 &&
      second.status === 200 &&
      newRows >= 2 &&
      uniqueTimes.size === secondItems.length &&
      newestFirst
        ? "PASS"
        : "FAIL",
  },
};

await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.recentCheck));
process.exitCode = result.recentCheck.status === "PASS" ? 0 : 1;
