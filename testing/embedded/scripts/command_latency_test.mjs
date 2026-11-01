#!/usr/bin/env node
/** Measure API request -> HTTP 202 -> ESP32 ACK/status using a no-GPIO-change command. */

import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const output = process.argv[2];
if (!output) throw new Error("Usage: command_latency_test.mjs <output.json>");
const require = createRequire(new URL("../../../backend/package.json", import.meta.url));
const { WebSocket } = require("ws");
const base = "http://127.0.0.1:3000/api";
const socket = new WebSocket("ws://127.0.0.1:3000/ws");
const acks = new Map();

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WebSocket timeout")), 5000);
  socket.once("open", () => { clearTimeout(timeout); resolve(); });
  socket.once("error", reject);
});
socket.on("message", (raw) => {
  try {
    const message = JSON.parse(raw.toString());
    if (message.type === "commandAck") acks.set(message.data.commandId, message.data);
  } catch { /* ignore malformed evidence input */ }
});

async function waitUntil(predicate, timeoutMs = 6000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await delay(20);
  }
  throw new Error("timeout");
}

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const statusBefore = await (await fetch(`${base}/status`)).json();
if (statusBefore.fanOn || statusBefore.buzzerOn) throw new Error("outputs must be OFF");

const started = performance.now();
const accepted = await post("/control", {
  target: "FAN",
  fanOn: false,
  buzzerOn: false,
});
const httpAt = performance.now();
const ack = await waitUntil(() => acks.get(accepted.body.commandId));
const ackAt = performance.now();
await waitUntil(async () => {
  const status = await (await fetch(`${base}/status`)).json();
  return !status.fanOn && !status.buzzerOn && status.fanManualOverride;
});
const statusAt = performance.now();

const resume = await post("/control/resume-automation", { actuator: "FAN" });
await waitUntil(() => acks.get(resume.body.commandId));
await waitUntil(async () => {
  const status = await (await fetch(`${base}/status`)).json();
  return !status.fanOn && !status.buzzerOn && !status.fanManualOverride;
});

const result = {
  at: new Date().toISOString(),
  source: "HARDWARE",
  condition: "NO_CHANGE outputs already OFF",
  httpStatus: accepted.status,
  ackSuccess: ack.success,
  requestToHttp202Ms: httpAt - started,
  requestToCommandAckMs: ackAt - started,
  requestToReportedStatusMs: statusAt - started,
  restored: true,
  status: accepted.status === 202 && ack.success ? "PASS" : "FAIL",
};
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result));
socket.close();
