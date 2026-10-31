import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { MqttClient } from "mqtt";

import {
  availabilityTopic,
  commandAckTopic,
  configAckTopic,
  telemetryTopic,
} from "../../shared/src/constants/topics.js";

import { parseRuleBody } from "../src/api/controllers/automationController.js";
import { isValidManualControlBody } from "../src/api/controllers/controlController.js";
import {
  parseHistoryQuery,
  parseRecentLimit,
} from "../src/api/controllers/telemetryController.js";
import { openDatabase } from "../src/database/database.js";
import { initializeSchema } from "../src/database/schema.js";
import { createCommandAckHandler } from "../src/mqtt/handlers/commandAckHandler.js";
import { createConfigAckHandler } from "../src/mqtt/handlers/configAckHandler.js";
import { createAvailabilityHandler } from "../src/mqtt/handlers/availabilityHandler.js";
import { createTelemetryHandler } from "../src/mqtt/handlers/telemetryHandler.js";
import { TelemetryProcessor } from "../src/processing/telemetryProcessor.js";
import { StatusRepository } from "../src/repositories/statusRepository.js";
import { TelemetryRepository } from "../src/repositories/telemetryRepository.js";
import { AutomationRepository } from "../src/repositories/automationRepository.js";
import { StatusService } from "../src/services/statusService.js";
import {
  ControlService,
  MqttUnavailableError,
} from "../src/services/controlService.js";
import { TelemetryService } from "../src/services/telemetryService.js";
import { AutomationService } from "../src/services/automationService.js";
import { DevicePresenceService } from "../src/services/devicePresenceService.js";

const deviceId = "esp32_01";
const temporaryDirectory = mkdtempSync(join(tmpdir(), "iot-backend-smoke-"));
const database = openDatabase(join(temporaryDirectory, "smoke.db"));

function approximatelyEqual(actual: number | null, expected: number): void {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual as number) - expected) < 0.000_001);
}

try {
  // Reproduce the pre-manual-control table to verify additive migration.
  database.exec(`
    CREATE TABLE device_status (
      device_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      online INTEGER NOT NULL,
      wifi_rssi_dbm INTEGER,
      uptime_ms INTEGER NOT NULL,
      firmware_version TEXT,
      last_seen_at_ms INTEGER NOT NULL
    )
  `);
  initializeSchema(database);
  const telemetryRepository = new TelemetryRepository(database);
  const statusRepository = new StatusRepository(database);
  const automationRepository = new AutomationRepository(database);
  const telemetryBroadcasts: unknown[] = [];
  const statusBroadcasts: unknown[] = [];
  const commandAckBroadcasts: unknown[] = [];
  const automationBroadcasts: unknown[] = [];
  const broadcaster = {
    broadcastTelemetry(data: unknown): void {
      telemetryBroadcasts.push(data);
    },
    broadcastStatus(data: unknown): void {
      statusBroadcasts.push(data);
    },
    broadcastCommandAck(data: unknown): void {
      commandAckBroadcasts.push(data);
    },
    broadcastAutomation(data: unknown): void {
      automationBroadcasts.push(data);
    },
  };
  const presenceService = new DevicePresenceService(
    deviceId,
    15_000,
    statusRepository,
    broadcaster,
  );

  const processor = new TelemetryProcessor();
  const telemetryService = new TelemetryService(
    deviceId,
    telemetryRepository,
    processor,
    broadcaster,
  );
  telemetryService.restoreEmaState();

  const firstPayload = {
    schemaVersion: 1,
    deviceId,
    temperatureC: 20,
    humidityPct: 50,
    lightRaw: 1000,
    dhtValid: true,
    uptimeMs: 100,
  };
  assert.ok(telemetryService.handle(firstPayload, deviceId, 1_000));
  const first = telemetryRepository.findLatest(deviceId);
  assert.equal(first?.temperatureEma, 20);
  assert.equal(first?.humidityEma, 50);
  assert.equal(first?.lightEma, 1000);

  const telemetryHandler = createTelemetryHandler(deviceId, telemetryService);
  telemetryHandler(telemetryTopic(deviceId), Buffer.from("not-json"));
  telemetryHandler("iot/other/telemetry", Buffer.from(JSON.stringify(firstPayload)));
  assert.equal(
    telemetryService.handle({ ...firstPayload, deviceId: "other" }, deviceId, 1_100),
    null,
  );
  assert.equal(
    telemetryService.handle({ ...firstPayload, lightRaw: 4096 }, deviceId, 1_200),
    null,
  );
  assert.equal(
    telemetryRepository.findHistory(deviceId, {
      fromMs: 0,
      toMs: Number.MAX_SAFE_INTEGER,
      limit: 100,
    }).length,
    1,
  );

  assert.ok(
    telemetryService.handle(
      {
        ...firstPayload,
        temperatureC: 30,
        humidityPct: 60,
        lightRaw: 2000,
        uptimeMs: 200,
      },
      deviceId,
      2_000,
    ),
  );
  const second = telemetryRepository.findLatest(deviceId);
  approximatelyEqual(second?.temperatureEma ?? null, 22);
  approximatelyEqual(second?.humidityEma ?? null, 52);
  approximatelyEqual(second?.lightEma ?? null, 1200);

  assert.ok(
    telemetryService.handle(
      {
        ...firstPayload,
        temperatureC: null,
        humidityPct: null,
        lightRaw: 3000,
        dhtValid: false,
        uptimeMs: 300,
      },
      deviceId,
      3_000,
    ),
  );
  const invalidDht = telemetryRepository.findLatest(deviceId);
  assert.equal(invalidDht?.temperatureC, null);
  assert.equal(invalidDht?.humidityPct, null);
  assert.equal(invalidDht?.temperatureEma, null);
  assert.equal(invalidDht?.humidityEma, null);
  approximatelyEqual(invalidDht?.lightEma ?? null, 1560);

  const restartedProcessor = new TelemetryProcessor();
  const restartedService = new TelemetryService(
    deviceId,
    telemetryRepository,
    restartedProcessor,
    broadcaster,
  );
  restartedService.restoreEmaState();
  assert.ok(
    restartedService.handle(
      {
        ...firstPayload,
        temperatureC: 40,
        humidityPct: 70,
        lightRaw: 4000,
        uptimeMs: 400,
      },
      deviceId,
      4_000,
    ),
  );
  const afterRestart = telemetryRepository.findLatest(deviceId);
  approximatelyEqual(afterRestart?.temperatureEma ?? null, 25.6);
  approximatelyEqual(afterRestart?.humidityEma ?? null, 55.6);
  approximatelyEqual(afterRestart?.lightEma ?? null, 2048);

  const history = telemetryRepository.findHistory(deviceId, {
    fromMs: 1_500,
    toMs: 4_000,
    limit: 100,
  });
  assert.deepEqual(
    history.map((item) => item.receivedAtMs),
    [2_000, 3_000, 4_000],
  );
  assert.deepEqual(
    telemetryRepository.findRecent(deviceId, 2).map((item) => item.receivedAtMs),
    [3_000, 4_000],
  );
  assert.equal(parseRecentLimit(undefined), 1_800);
  assert.equal(parseRecentLimit("1800"), 1_800);
  assert.equal(parseRecentLimit("0"), null);
  assert.equal(parseRecentLimit("5001"), null);
  assert.deepEqual(parseHistoryQuery({ from: "1500", to: "4000" }), {
    query: { fromMs: 1_500, toMs: 4_000, limit: 20_000 },
  });
  assert.match(parseHistoryQuery({ to: "4000" }).error ?? "", /Bắt buộc có tham số from/);
  assert.match(parseHistoryQuery({ from: "4000" }).error ?? "", /Bắt buộc có tham số to/);
  assert.match(parseHistoryQuery({ from: "4000", to: "4000" }).error ?? "", /from phải nhỏ hơn to/);
  assert.match(parseHistoryQuery({ from: "5000", to: "4000" }).error ?? "", /from phải nhỏ hơn to/);
  assert.equal(telemetryBroadcasts.length, 4);

  const retentionDatabase = openDatabase(
    join(temporaryDirectory, "retention-smoke.db"),
  );
  try {
    initializeSchema(retentionDatabase);
    retentionDatabase.prepare(`
      INSERT INTO automation_config (
        device_id, enabled, config_version, sync_state, updated_at_ms
      ) VALUES (?, 1, 1, 'SYNCED', 1)
    `).run(deviceId);
    const retentionRepository = new TelemetryRepository(
      retentionDatabase,
      10_000,
      100,
    );
    retentionDatabase.transaction(() => {
      for (let index = 1; index <= 10_100; index += 1) {
        retentionRepository.insert({
          deviceId,
          schemaVersion: 1,
          temperatureC: 25,
          humidityPct: 60,
          lightRaw: 1_000,
          dhtValid: true,
          uptimeMs: index * 2_000,
          temperatureEma: 25,
          humidityEma: 60,
          lightEma: 1_000,
          receivedAtMs: index,
        });
      }
    })();
    const retentionCount = retentionDatabase
      .prepare<[], { count: number }>(
        "SELECT COUNT(*) AS count FROM sensor_readings",
      )
      .get();
    const retainedBounds = retentionDatabase
      .prepare<[], { oldest: number; newest: number }>(`
        SELECT MIN(received_at_ms) AS oldest, MAX(received_at_ms) AS newest
        FROM sensor_readings
      `)
      .get();
    assert.equal(retentionCount?.count, 10_000);
    assert.deepEqual(retainedBounds, { oldest: 101, newest: 10_100 });
    assert.deepEqual(
      retentionRepository.findRecent(deviceId, 3).map((item) => item.receivedAtMs),
      [10_098, 10_099, 10_100],
    );
    assert.equal(
      retentionDatabase
        .prepare<[], { count: number }>(
          "SELECT COUNT(*) AS count FROM automation_config",
        )
        .get()?.count,
      1,
    );
  } finally {
    retentionDatabase.close();
  }

  assert.equal(presenceService.getView(3_500).presence, "UNKNOWN");
  assert.equal(presenceService.getView(3_500).mqttConnected, false);
  presenceService.setMqttConnected(true, 3_500);
  const statusService = new StatusService(deviceId, statusRepository, presenceService);
  assert.ok(
    statusService.handle(
      {
        schemaVersion: 1,
        deviceId,
        wifiRssiDbm: -58,
        uptimeMs: 400,
        firmwareVersion: "0.2.0",
        fanOn: true,
        buzzerOn: false,
        fanSource: "AUTOMATION",
        buzzerSource: "MANUAL_BASE",
        fanManualOverride: false,
        buzzerManualOverride: false,
        fanActiveRuleId: "rule-runtime-1",
        buzzerActiveRuleId: null,
        automationConfigVersion: 2,
        automationEnabled: true,
        ruleStates: [{ id: "rule-runtime-1", state: "ACTIVE" }],
      },
      deviceId,
      4_000,
    ),
  );
  assert.ok(
    statusService.handle(
      {
        schemaVersion: 1,
        deviceId,
        wifiSsid: "SmartHome",
        ipAddress: "192.168.1.105",
        wifiRssiDbm: -70,
        uptimeMs: 500,
        firmwareVersion: "0.2.0",
        fanOn: false,
        buzzerOn: true,
        fanSource: "MANUAL_OVERRIDE",
        buzzerSource: "MANUAL_OVERRIDE",
        fanManualOverride: true,
        buzzerManualOverride: true,
        fanActiveRuleId: null,
        buzzerActiveRuleId: null,
        automationConfigVersion: 2,
        automationEnabled: true,
        ruleStates: [],
      },
      deviceId,
      5_000,
    ),
  );
  assert.equal(
    statusService.handle(
      {
        schemaVersion: 1,
        deviceId,
        wifiSsid: "SmartHome",
        ipAddress: "192.168.1.105",
        wifiRssiDbm: -58,
        uptimeMs: Number.MAX_SAFE_INTEGER + 1,
        firmwareVersion: "0.2.0",
        fanOn: false,
        buzzerOn: false,
        fanSource: "MANUAL_BASE",
        buzzerSource: "MANUAL_BASE",
        fanManualOverride: false,
        buzzerManualOverride: false,
        fanActiveRuleId: null,
        buzzerActiveRuleId: null,
        automationConfigVersion: 2,
        automationEnabled: true,
        ruleStates: [],
      },
      deviceId,
      5_100,
    ),
    null,
  );
  assert.deepEqual(statusRepository.findByDeviceId(deviceId), {
    deviceId,
    online: true,
    presence: "UNKNOWN",
    mqttConnected: false,
    wifiSsid: "SmartHome",
    ipAddress: "192.168.1.105",
    wifiRssiDbm: -70,
    uptimeMs: 500,
    firmwareVersion: "0.2.0",
    fanOn: false,
    buzzerOn: true,
    fanSource: "MANUAL_OVERRIDE",
    buzzerSource: "MANUAL_OVERRIDE",
    fanManualOverride: true,
    buzzerManualOverride: true,
    fanActiveRuleId: null,
    buzzerActiveRuleId: null,
    automationConfigVersion: 2,
    automationEnabled: true,
    ruleStates: [],
    lastSeenAtMs: 5_000,
  });
  assert.equal(presenceService.getView(5_000).presence, "ONLINE");
  assert.equal(presenceService.getView(5_000).mqttConnected, true);

  let availabilityNowMs = 6_000;
  const availabilityHandler = createAvailabilityHandler(
    deviceId,
    presenceService,
    () => availabilityNowMs,
  );
  assert.equal(
    availabilityHandler(availabilityTopic(deviceId), Buffer.from("online")),
    true,
  );
  assert.equal(presenceService.getView(6_000).presence, "ONLINE");
  assert.equal(
    availabilityHandler(availabilityTopic(deviceId), Buffer.from("invalid")),
    false,
  );
  availabilityNowMs = 6_100;
  assert.equal(
    availabilityHandler(availabilityTopic(deviceId), Buffer.from("offline")),
    true,
  );
  assert.equal(presenceService.getView(6_100).presence, "OFFLINE");
  presenceService.setMqttConnected(false, 6_200);
  assert.equal(presenceService.getView(6_200).presence, "UNKNOWN");
  presenceService.setMqttConnected(true, 7_000);
  assert.equal(presenceService.getView(7_000).presence, "ONLINE");
  presenceService.checkLiveness(20_001);
  assert.equal(presenceService.getView(20_001).presence, "OFFLINE");
  presenceService.handleAvailability("ONLINE", 22_000);
  assert.equal(presenceService.getView(22_000).presence, "ONLINE");
  presenceService.checkLiveness(37_001);
  assert.equal(presenceService.getView(37_001).presence, "OFFLINE");
  const statusCount = database
    .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM device_status")
    .get();
  assert.equal(statusCount?.count, 1);
  assert.ok(statusBroadcasts.length >= 8);

  const commandAckHandler = createCommandAckHandler(deviceId, broadcaster);
  commandAckHandler(
    commandAckTopic(deviceId),
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        deviceId,
        commandId: "command-1",
        success: true,
        fanOn: true,
        buzzerOn: false,
      }),
    ),
  );
  commandAckHandler(commandAckTopic(deviceId), Buffer.from("not-json"));
  assert.equal(commandAckBroadcasts.length, 1);
  assert.equal(isValidManualControlBody({ target: "FAN", fanOn: true, buzzerOn: false }), true);
  assert.equal(isValidManualControlBody({ target: "LIGHT", fanOn: true, buzzerOn: false }), false);
  assert.equal(isValidManualControlBody({ target: "FAN", fanOn: "true", buzzerOn: false }), false);
  assert.ok(parseRuleBody({ name: "Valid", enabled: true, condition: { sensor: "HUMIDITY", operator: ">=", threshold: 70 }, action: { actuator: "FAN", state: "ON" } }));
  assert.equal(parseRuleBody({ name: "Invalid range", enabled: true, condition: { sensor: "HUMIDITY", operator: ">=", threshold: 101 }, action: { actuator: "FAN", state: "ON" } }), null);

  const publishedMessages: Array<{ topic: string; payload: string }> = [];
  const connectedMqttClient = {
    connected: true,
    publish(
      topic: string,
      payload: string,
      _options: { qos: 0 },
      callback: (error?: Error) => void,
    ): void {
      publishedMessages.push({ topic, payload });
      callback();
    },
  } as unknown as MqttClient;
  const controlService = new ControlService(connectedMqttClient, deviceId);
  const publishedCommand = await controlService.publishManualControl("FAN", true, false);
  assert.equal(publishedCommand.published, true);
  assert.equal(publishedMessages.length, 1);
  assert.equal(publishedMessages[0]?.topic, `iot/${deviceId}/command`);
  assert.deepEqual(JSON.parse(publishedMessages[0]?.payload ?? "{}"), {
    schemaVersion: 1,
    commandId: publishedCommand.commandId,
    mode: "MANUAL",
    target: "FAN",
    fanOn: true,
    buzzerOn: false,
  });
  const resumedCommand = await controlService.publishResumeAutomation("FAN");
  assert.equal(resumedCommand.published, true);
  assert.deepEqual(JSON.parse(publishedMessages[1]?.payload ?? "{}"), {
    schemaVersion: 1,
    commandId: resumedCommand.commandId,
    mode: "RESUME_AUTOMATION",
    target: "FAN",
  });

  const disconnectedMqttClient = {
    connected: false,
  } as unknown as MqttClient;
  await assert.rejects(
    new ControlService(
      disconnectedMqttClient,
      deviceId,
    ).publishManualControl("BUZZER", false, false),
    MqttUnavailableError,
  );

  const automationPublished: Array<{
    topic: string;
    payload: string;
    options: { qos: number; retain: boolean };
  }> = [];
  const automationMqttClient = {
    connected: true,
    on(): void {},
    publish(
      topic: string,
      payload: string,
      options: { qos: number; retain: boolean },
      callback: (error?: Error) => void,
    ): void {
      automationPublished.push({ topic, payload, options });
      callback();
    },
  } as unknown as MqttClient;
  const automationService = new AutomationService(
    deviceId,
    automationRepository,
    statusRepository,
    automationMqttClient,
    broadcaster,
  );
  assert.deepEqual(automationService.getView().rules, []);

  const olderView = await automationService.createRule({
    name: "Older fan ON",
    enabled: true,
    sensor: "TEMPERATURE",
    operator: ">=",
    threshold: 30,
    unit: "°C",
    actuator: "FAN",
    action: "ON",
  });
  const older = olderView.rules[0];
  assert.ok(older);
  assert.match(older.id, /^[0-9a-f-]{36}$/);
  assert.equal(older.createdSequence, 1);

  const newerView = await automationService.createRule({
    name: "Newer fan OFF",
    enabled: true,
    sensor: "HUMIDITY",
    operator: ">",
    threshold: 70,
    unit: "%",
    actuator: "FAN",
    action: "OFF",
  });
  const newer = newerView.rules[1];
  assert.ok(newer);
  assert.equal(newer.createdSequence, 2);
  assert.ok(newer.createdSequence > older.createdSequence);

  const originalCreatedAt = older.createdAtMs;
  const editedView = await automationService.updateRule(older.id, {
    name: "Older fan edited",
    enabled: true,
    sensor: "LIGHT",
    operator: "<=",
    threshold: 500,
    unit: "ADC",
    actuator: "FAN",
    action: "ON",
  });
  assert.equal(
    editedView?.rules.find((rule) => rule.id === older.id)?.createdAtMs,
    originalCreatedAt,
  );

  const disabledView = await automationService.setRuleEnabled(older.id, false);
  assert.equal(
    disabledView?.rules.find((rule) => rule.id === older.id)?.enabled,
    false,
  );
  const masterOffView = await automationService.setAutomationEnabled(false);
  assert.equal(masterOffView.enabled, false);
  const deletedView = await automationService.deleteRule(newer.id);
  assert.equal(deletedView?.rules.some((rule) => rule.id === newer.id), false);
  assert.ok(automationPublished.length >= 6);
  const lastConfig = JSON.parse(
    automationPublished.at(-1)?.payload ?? "{}",
  ) as Record<string, unknown>;
  assert.equal(
    automationPublished.at(-1)?.topic,
    `iot/${deviceId}/config`,
  );
  assert.deepEqual(automationPublished.at(-1)?.options, {
    qos: 1,
    retain: true,
  });
  assert.equal(lastConfig.automationEnabled, false);

  const latestVersion = deletedView?.configVersion ?? 0;
  const configAckHandler = createConfigAckHandler(deviceId, automationService);
  configAckHandler(
    configAckTopic(deviceId),
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        deviceId,
        configVersion: latestVersion,
        success: true,
      }),
    ),
  );
  assert.equal(automationService.getView().syncState, "SYNCED");
  assert.equal(automationService.getView().appliedVersion, latestVersion);
  automationService.handleAck({
    schemaVersion: 1,
    deviceId,
    configVersion: latestVersion - 1,
    success: true,
  });
  assert.equal(automationService.getView().syncState, "SYNCED");
  assert.equal(automationService.getView().appliedVersion, latestVersion);
  assert.ok(automationBroadcasts.length >= 7);

  const tables = database
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
  assert.ok(tables.includes("sensor_readings"));
  assert.ok(tables.includes("device_status"));
  assert.ok(tables.includes("automation_config"));
  assert.ok(tables.includes("automation_rules"));

  const statusColumns = database
    .prepare<[], { name: string }>("PRAGMA table_info(device_status)")
    .all()
    .map((row) => row.name);
  assert.ok(statusColumns.includes("mode"));
  assert.ok(statusColumns.includes("fan_on"));
  assert.ok(statusColumns.includes("buzzer_on"));
  assert.ok(statusColumns.includes("wifi_ssid"));
  assert.ok(statusColumns.includes("ip_address"));
  assert.ok(statusColumns.includes("fan_source"));
  assert.ok(statusColumns.includes("automation_config_version"));

  console.log(
    "Backend presence/LWT fallback, Automation CRUD/version/ACK, MQTT validation, control, EMA, recent telemetry, retention, and UPSERT smoke checks: PASS",
  );
} finally {
  database.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
