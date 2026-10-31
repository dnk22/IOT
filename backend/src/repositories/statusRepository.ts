import type Database from "better-sqlite3";

import type { SqliteDatabase } from "../database/database.js";
import type {
  AutomationRuleRuntimeStatus,
  ControlSource,
  DevicePresence,
} from "../../../shared/src/types/mqtt.js";

export interface StatusRecord {
  deviceId: string;
  schemaVersion: 1;
  online: boolean;
  wifiSsid: string | null;
  ipAddress: string | null;
  wifiRssiDbm: number;
  uptimeMs: number;
  firmwareVersion: string;
  fanOn: boolean;
  buzzerOn: boolean;
  fanSource: ControlSource;
  buzzerSource: ControlSource;
  fanActiveRuleId: string | null;
  buzzerActiveRuleId: string | null;
  automationConfigVersion: number;
  automationEnabled: boolean;
  fanManualOverride: boolean;
  buzzerManualOverride: boolean;
  ruleStates: AutomationRuleRuntimeStatus[];
  lastSeenAtMs: number;
}

export interface StatusView {
  deviceId: string;
  online: boolean;
  presence: DevicePresence;
  mqttConnected: boolean;
  wifiSsid: string | null;
  ipAddress: string | null;
  wifiRssiDbm: number | null;
  uptimeMs: number;
  firmwareVersion: string | null;
  fanOn: boolean | null;
  buzzerOn: boolean | null;
  fanSource: ControlSource | null;
  buzzerSource: ControlSource | null;
  fanActiveRuleId: string | null;
  buzzerActiveRuleId: string | null;
  automationConfigVersion: number;
  automationEnabled: boolean;
  fanManualOverride: boolean;
  buzzerManualOverride: boolean;
  ruleStates: AutomationRuleRuntimeStatus[];
  lastSeenAtMs: number;
}

interface StatusUpsertParameters {
  deviceId: string;
  schemaVersion: number;
  online: number;
  wifiSsid: string | null;
  ipAddress: string | null;
  wifiRssiDbm: number;
  uptimeMs: number;
  firmwareVersion: string;
  mode: string | null;
  fanOn: number;
  buzzerOn: number;
  fanSource: string;
  buzzerSource: string;
  fanActiveRuleId: string | null;
  buzzerActiveRuleId: string | null;
  automationConfigVersion: number;
  automationEnabled: number;
  fanManualOverride: number;
  buzzerManualOverride: number;
  ruleStatesJson: string;
  lastSeenAtMs: number;
}

interface StatusRow {
  device_id: string;
  online: number;
  wifi_ssid: string | null;
  ip_address: string | null;
  wifi_rssi_dbm: number | null;
  uptime_ms: number;
  firmware_version: string | null;
  mode: string | null;
  fan_on: number | null;
  buzzer_on: number | null;
  fan_source: string | null;
  buzzer_source: string | null;
  fan_active_rule_id: string | null;
  buzzer_active_rule_id: string | null;
  automation_config_version: number;
  automation_enabled: number;
  fan_manual_override: number;
  buzzer_manual_override: number;
  rule_states_json: string;
  last_seen_at_ms: number;
}

function mapStatusRow(
  row: StatusRow,
): Omit<StatusView, "presence" | "mqttConnected"> {
  return {
    deviceId: row.device_id,
    online: row.online === 1,
    wifiSsid: row.wifi_ssid,
    ipAddress: row.ip_address,
    wifiRssiDbm: row.wifi_rssi_dbm,
    uptimeMs: row.uptime_ms,
    firmwareVersion: row.firmware_version,
    fanOn: row.fan_on === null ? null : row.fan_on === 1,
    buzzerOn: row.buzzer_on === null ? null : row.buzzer_on === 1,
    fanSource:
      row.fan_source === "MANUAL_BASE" || row.fan_source === "MANUAL_OVERRIDE" || row.fan_source === "AUTOMATION"
        ? row.fan_source
        : null,
    buzzerSource:
      row.buzzer_source === "MANUAL_BASE" || row.buzzer_source === "MANUAL_OVERRIDE" || row.buzzer_source === "AUTOMATION"
        ? row.buzzer_source
        : null,
    fanActiveRuleId: row.fan_active_rule_id,
    buzzerActiveRuleId: row.buzzer_active_rule_id,
    automationConfigVersion: row.automation_config_version,
    automationEnabled: row.automation_enabled === 1,
    fanManualOverride: row.fan_manual_override === 1,
    buzzerManualOverride: row.buzzer_manual_override === 1,
    ruleStates: parseRuleStates(row.rule_states_json),
    lastSeenAtMs: row.last_seen_at_ms,
  };
}

function parseRuleStates(value: string): AutomationRuleRuntimeStatus[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as AutomationRuleRuntimeStatus[] : [];
  } catch {
    return [];
  }
}

export class StatusRepository {
  private readonly upsertStatement: Database.Statement<StatusUpsertParameters>;
  private readonly getStatement: Database.Statement<[string], StatusRow>;
  private readonly touchLastSeenStatement: Database.Statement<[number, string]>;
  private readonly setOnlineStatement: Database.Statement<[number, string]>;

  constructor(database: SqliteDatabase) {
    this.upsertStatement = database.prepare<StatusUpsertParameters>(`
      INSERT INTO device_status (
        device_id, schema_version, online, wifi_ssid, ip_address,
        wifi_rssi_dbm, uptime_ms, firmware_version, mode, fan_on, buzzer_on,
        fan_source, buzzer_source, fan_active_rule_id, buzzer_active_rule_id,
        automation_config_version, fan_manual_override, buzzer_manual_override,
        automation_enabled, rule_states_json, last_seen_at_ms
      ) VALUES (
        @deviceId, @schemaVersion, @online, @wifiSsid, @ipAddress,
        @wifiRssiDbm, @uptimeMs, @firmwareVersion, @mode, @fanOn, @buzzerOn,
        @fanSource, @buzzerSource, @fanActiveRuleId, @buzzerActiveRuleId,
        @automationConfigVersion, @fanManualOverride, @buzzerManualOverride,
        @automationEnabled, @ruleStatesJson, @lastSeenAtMs
      )
      ON CONFLICT(device_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        online = excluded.online,
        wifi_ssid = excluded.wifi_ssid,
        ip_address = excluded.ip_address,
        wifi_rssi_dbm = excluded.wifi_rssi_dbm,
        uptime_ms = excluded.uptime_ms,
        firmware_version = excluded.firmware_version,
        mode = excluded.mode,
        fan_on = excluded.fan_on,
        buzzer_on = excluded.buzzer_on,
        fan_source = excluded.fan_source,
        buzzer_source = excluded.buzzer_source,
        fan_active_rule_id = excluded.fan_active_rule_id,
        buzzer_active_rule_id = excluded.buzzer_active_rule_id,
        automation_config_version = excluded.automation_config_version,
        fan_manual_override = excluded.fan_manual_override,
        buzzer_manual_override = excluded.buzzer_manual_override,
        automation_enabled = excluded.automation_enabled,
        rule_states_json = excluded.rule_states_json,
        last_seen_at_ms = excluded.last_seen_at_ms
    `);

    this.getStatement = database.prepare<[string], StatusRow>(`
      SELECT device_id, online, wifi_ssid, ip_address, wifi_rssi_dbm,
             uptime_ms, firmware_version, mode, fan_on, buzzer_on,
             fan_source, buzzer_source, fan_active_rule_id,
             buzzer_active_rule_id, automation_config_version,
             fan_manual_override, buzzer_manual_override, automation_enabled,
             rule_states_json, last_seen_at_ms
      FROM device_status
      WHERE device_id = ?
    `);
    this.touchLastSeenStatement = database.prepare<[number, string]>(`
      UPDATE device_status
      SET last_seen_at_ms = MAX(last_seen_at_ms, ?)
      WHERE device_id = ?
    `);
    this.setOnlineStatement = database.prepare<[number, string]>(`
      UPDATE device_status SET online = ? WHERE device_id = ?
    `);
  }

  upsert(record: StatusRecord): void {
    this.upsertStatement.run({
      ...record,
      mode: null,
      online: record.online ? 1 : 0,
      fanOn: record.fanOn ? 1 : 0,
      buzzerOn: record.buzzerOn ? 1 : 0,
      fanManualOverride: record.fanManualOverride ? 1 : 0,
      buzzerManualOverride: record.buzzerManualOverride ? 1 : 0,
      automationEnabled: record.automationEnabled ? 1 : 0,
      ruleStatesJson: JSON.stringify(record.ruleStates),
    });
  }

  findByDeviceId(deviceId: string): StatusView | null {
    const row = this.getStatement.get(deviceId);
    return row
      ? { ...mapStatusRow(row), presence: "UNKNOWN", mqttConnected: false }
      : null;
  }

  touchLastSeen(deviceId: string, receivedAtMs: number): void {
    this.touchLastSeenStatement.run(receivedAtMs, deviceId);
  }

  setAvailabilityOnline(deviceId: string, online: boolean): void {
    this.setOnlineStatement.run(online ? 1 : 0, deviceId);
  }
}
