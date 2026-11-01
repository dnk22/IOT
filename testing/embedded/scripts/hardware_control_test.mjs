#!/usr/bin/env node
/** Safe bounded actuator/API/WS test. Always restores both outputs OFF and resumes automation. */

import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(new URL("../../../backend/package.json", import.meta.url));
const { WebSocket } = require("ws");

const apiBase = process.env.TEST_API_BASE ?? "http://127.0.0.1:3000/api";
const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/api$/, "/ws");
const evidence = [];
const pendingAcks = new Map();
const seenAcks = new Map();

function record(testId, status, detail, extra = {}) {
  const row = { at: new Date().toISOString(), testId, status, detail, ...extra };
  evidence.push(row);
  console.log(JSON.stringify(row));
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function waitForAck(commandId, timeoutMs = 5000) {
  if (seenAcks.has(commandId)) {
    const payload = seenAcks.get(commandId);
    seenAcks.delete(commandId);
    return payload;
  }
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingAcks.delete(commandId);
      reject(new Error(`ACK timeout for ${commandId}`));
    }, timeoutMs);
    pendingAcks.set(commandId, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function waitForStatus(predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await request("/status");
    if (result.status === 200 && predicate(result.body)) return result.body;
    await delay(150);
  }
  throw new Error("status convergence timeout");
}

async function control(target, fanOn, buzzerOn, testId) {
  const result = await request("/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target, fanOn, buzzerOn }),
  });
  if (result.status !== 202 || !result.body?.commandId) {
    throw new Error(`${testId}: HTTP ${result.status}`);
  }
  const ack = await waitForAck(result.body.commandId);
  if (!ack.success || ack.fanOn !== fanOn || ack.buzzerOn !== buzzerOn) {
    throw new Error(`${testId}: ACK state mismatch`);
  }
  await waitForStatus(
    (status) => status.fanOn === fanOn && status.buzzerOn === buzzerOn,
  );
  record(testId, "PASS", "HTTP 202, MQTT ACK và status đồng bộ", {
    target,
    fanOn,
    buzzerOn,
  });
}

async function resume(actuator) {
  const result = await request("/control/resume-automation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actuator }),
  });
  if (result.status !== 202 || !result.body?.commandId) {
    throw new Error(`resume ${actuator}: HTTP ${result.status}`);
  }
  const ack = await waitForAck(result.body.commandId);
  if (!ack.success) throw new Error(`resume ${actuator}: negative ACK`);
}

const socket = new WebSocket(wsUrl);
socket.on("message", (raw) => {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (message.type !== "commandAck") return;
  const resolver = pendingAcks.get(message.data?.commandId);
  if (resolver) {
    pendingAcks.delete(message.data.commandId);
    resolver(message.data);
  } else {
    seenAcks.set(message.data.commandId, message.data);
  }
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WebSocket open timeout")), 5000);
  socket.once("open", () => {
    clearTimeout(timeout);
    resolve();
  });
  socket.once("error", reject);
});

let exitCode = 0;
try {
  const initial = await request("/status");
  if (
    initial.status !== 200 ||
    !initial.body?.online ||
    !initial.body?.mqttConnected ||
    initial.body.fanOn ||
    initial.body.buzzerOn
  ) {
    throw new Error("Precondition failed: device must be online, MQTT connected, outputs OFF");
  }
  record("F01/F02", "PASS", "Thiết bị online, MQTT connected, cả hai đầu ra OFF");

  const invalidBody = await request("/control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target: "INVALID", fanOn: true, buzzerOn: false }),
  });
  record(
    "F12",
    invalidBody.status === 400 ? "PASS" : "FAIL",
    `Payload sai bị từ chối HTTP ${invalidBody.status}`,
  );

  const wrongType = await request("/control", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not-json",
  });
  record(
    "F12",
    wrongType.status === 415 ? "PASS" : "FAIL",
    `Content-Type sai bị từ chối HTTP ${wrongType.status}`,
  );

  await control("FAN", true, false, "F07/F09-FAN-ON");
  await delay(1000);
  await control("FAN", false, false, "F07/F09-FAN-OFF");

  await control("BUZZER", false, true, "F07/F09-BUZZER-ON");
  await delay(500);
  await control("BUZZER", false, false, "F07/F09-BUZZER-OFF");
} catch (error) {
  exitCode = 1;
  record("HARDWARE", "FAIL", error instanceof Error ? error.message : String(error));
} finally {
  try {
    await control("FAN", false, false, "RESTORE-FAN-OFF");
    await control("BUZZER", false, false, "RESTORE-BUZZER-OFF");
    await resume("FAN");
    await resume("BUZZER");
    await waitForStatus(
      (status) =>
        !status.fanOn &&
        !status.buzzerOn &&
        !status.fanManualOverride &&
        !status.buzzerManualOverride,
      8000,
    );
    record("RESTORE", "PASS", "Cả hai đầu ra OFF, manual override đã bỏ");
  } catch (error) {
    exitCode = 1;
    record("RESTORE", "FAIL", error instanceof Error ? error.message : String(error));
  }
  socket.close();
}

process.exitCode = exitCode;
