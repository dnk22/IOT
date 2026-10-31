import type {
  AutomationAction,
  AutomationActuator,
  AutomationOperator,
  AutomationSensor,
  AutomationUnit,
} from "../../../shared/src/types/mqtt.js";

import type { SqliteDatabase } from "../database/database.js";

export type AutomationSyncState = "PENDING" | "SYNCED" | "ERROR";

export interface AutomationRuleRecord {
  id: string;
  deviceId: string;
  name: string;
  enabled: boolean;
  sensor: AutomationSensor;
  operator: AutomationOperator;
  threshold: number;
  unit: AutomationUnit;
  actuator: AutomationActuator;
  action: AutomationAction;
  createdSequence: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AutomationConfigurationRecord {
  deviceId: string;
  enabled: boolean;
  configVersion: number;
  appliedVersion: number | null;
  syncState: AutomationSyncState;
  syncError: string | null;
  updatedAtMs: number;
  rules: AutomationRuleRecord[];
}

export interface AutomationRuleWrite {
  name: string;
  enabled: boolean;
  sensor: AutomationSensor;
  operator: AutomationOperator;
  threshold: number;
  unit: AutomationUnit;
  actuator: AutomationActuator;
  action: AutomationAction;
}

interface ConfigRow {
  device_id: string;
  enabled: number;
  config_version: number;
  applied_version: number | null;
  sync_state: AutomationSyncState;
  sync_error: string | null;
  updated_at_ms: number;
}

interface RuleRow {
  id: string;
  device_id: string;
  name: string;
  enabled: number;
  sensor: AutomationSensor;
  operator: AutomationOperator;
  threshold: number;
  unit: AutomationUnit;
  actuator: AutomationActuator;
  action: AutomationAction;
  created_sequence: number;
  created_at_ms: number;
  updated_at_ms: number;
}

interface SequenceRow {
  next_sequence: number;
}

function mapRule(row: RuleRow): AutomationRuleRecord {
  return {
    id: row.id,
    deviceId: row.device_id,
    name: row.name,
    enabled: row.enabled === 1,
    sensor: row.sensor,
    operator: row.operator,
    threshold: row.threshold,
    unit: row.unit,
    actuator: row.actuator,
    action: row.action,
    createdSequence: row.created_sequence,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

export class AutomationRepository {
  constructor(private readonly database: SqliteDatabase) {}

  getConfiguration(deviceId: string, nowMs = Date.now()): AutomationConfigurationRecord {
    this.ensureConfiguration(deviceId, nowMs);
    const config = this.database
      .prepare<[string], ConfigRow>(
        "SELECT device_id, enabled, config_version, applied_version, sync_state, sync_error, updated_at_ms FROM automation_config WHERE device_id = ?",
      )
      .get(deviceId);
    if (!config) {
      throw new Error("Automation configuration could not be initialized.");
    }

    const rules = this.database
      .prepare<[string], RuleRow>(
        "SELECT id, device_id, name, enabled, sensor, operator, threshold, unit, actuator, action, created_sequence, created_at_ms, updated_at_ms FROM automation_rules WHERE device_id = ? ORDER BY created_sequence ASC",
      )
      .all(deviceId)
      .map(mapRule);

    return {
      deviceId: config.device_id,
      enabled: config.enabled === 1,
      configVersion: config.config_version,
      appliedVersion: config.applied_version,
      syncState: config.sync_state,
      syncError: config.sync_error,
      updatedAtMs: config.updated_at_ms,
      rules,
    };
  }

  createRule(
    deviceId: string,
    id: string,
    write: AutomationRuleWrite,
    nowMs: number,
  ): AutomationConfigurationRecord {
    this.database.transaction(() => {
      this.ensureConfiguration(deviceId, nowMs);
      const sequence = this.database
        .prepare<[string], SequenceRow>(
          "SELECT COALESCE(MAX(created_sequence), 0) + 1 AS next_sequence FROM automation_rules WHERE device_id = ?",
        )
        .get(deviceId)?.next_sequence ?? 1;
      this.database.prepare(
        "INSERT INTO automation_rules (id, device_id, name, enabled, sensor, operator, threshold, unit, actuator, action, created_sequence, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        deviceId,
        write.name,
        write.enabled ? 1 : 0,
        write.sensor,
        write.operator,
        write.threshold,
        write.unit,
        write.actuator,
        write.action,
        sequence,
        nowMs,
        nowMs,
      );
      this.bumpVersion(deviceId, nowMs);
    })();
    return this.getConfiguration(deviceId, nowMs);
  }

  updateRule(
    deviceId: string,
    id: string,
    write: AutomationRuleWrite,
    nowMs: number,
  ): AutomationConfigurationRecord | null {
    let updated = false;
    this.database.transaction(() => {
      const result = this.database.prepare(
        "UPDATE automation_rules SET name = ?, enabled = ?, sensor = ?, operator = ?, threshold = ?, unit = ?, actuator = ?, action = ?, updated_at_ms = ? WHERE id = ? AND device_id = ?",
      ).run(
        write.name,
        write.enabled ? 1 : 0,
        write.sensor,
        write.operator,
        write.threshold,
        write.unit,
        write.actuator,
        write.action,
        nowMs,
        id,
        deviceId,
      );
      updated = result.changes === 1;
      if (updated) this.bumpVersion(deviceId, nowMs);
    })();
    return updated ? this.getConfiguration(deviceId, nowMs) : null;
  }

  deleteRule(deviceId: string, id: string, nowMs: number): AutomationConfigurationRecord | null {
    let deleted = false;
    this.database.transaction(() => {
      const result = this.database
        .prepare("DELETE FROM automation_rules WHERE id = ? AND device_id = ?")
        .run(id, deviceId);
      deleted = result.changes === 1;
      if (deleted) this.bumpVersion(deviceId, nowMs);
    })();
    return deleted ? this.getConfiguration(deviceId, nowMs) : null;
  }

  setRuleEnabled(
    deviceId: string,
    id: string,
    enabled: boolean,
    nowMs: number,
  ): AutomationConfigurationRecord | null {
    let updated = false;
    this.database.transaction(() => {
      const result = this.database
        .prepare("UPDATE automation_rules SET enabled = ?, updated_at_ms = ? WHERE id = ? AND device_id = ?")
        .run(enabled ? 1 : 0, nowMs, id, deviceId);
      updated = result.changes === 1;
      if (updated) this.bumpVersion(deviceId, nowMs);
    })();
    return updated ? this.getConfiguration(deviceId, nowMs) : null;
  }

  setAutomationEnabled(
    deviceId: string,
    enabled: boolean,
    nowMs: number,
  ): AutomationConfigurationRecord {
    this.database.transaction(() => {
      this.ensureConfiguration(deviceId, nowMs);
      const current = this.database
        .prepare<[string], { enabled: number }>("SELECT enabled FROM automation_config WHERE device_id = ?")
        .get(deviceId);
      if ((current?.enabled === 1) !== enabled) {
        this.database
          .prepare("UPDATE automation_config SET enabled = ? WHERE device_id = ?")
          .run(enabled ? 1 : 0, deviceId);
        this.bumpVersion(deviceId, nowMs);
      }
    })();
    return this.getConfiguration(deviceId, nowMs);
  }

  recordAck(
    deviceId: string,
    configVersion: number,
    success: boolean,
    error: string | null,
    nowMs: number,
  ): AutomationConfigurationRecord {
    this.ensureConfiguration(deviceId, nowMs);
    const current = this.getConfiguration(deviceId, nowMs);
    if (configVersion > current.configVersion) {
      return current;
    }
    if (configVersion < current.configVersion &&
        (!success || (current.appliedVersion !== null && current.appliedVersion >= configVersion))) {
      return current;
    }

    const isLatest = configVersion === current.configVersion;
    this.database.prepare(
      "UPDATE automation_config SET applied_version = ?, sync_state = ?, sync_error = ?, updated_at_ms = ? WHERE device_id = ?",
    ).run(
      success ? configVersion : current.appliedVersion,
      isLatest ? (success ? "SYNCED" : "ERROR") : "PENDING",
      isLatest && !success ? error : null,
      nowMs,
      deviceId,
    );
    return this.getConfiguration(deviceId, nowMs);
  }

  markPending(deviceId: string, error: string | null, nowMs: number): void {
    this.ensureConfiguration(deviceId, nowMs);
    this.database
      .prepare("UPDATE automation_config SET sync_state = 'PENDING', sync_error = ?, updated_at_ms = ? WHERE device_id = ?")
      .run(error, nowMs, deviceId);
  }

  private ensureConfiguration(deviceId: string, nowMs: number): void {
    this.database.prepare(
      "INSERT OR IGNORE INTO automation_config (device_id, enabled, config_version, applied_version, sync_state, sync_error, updated_at_ms) VALUES (?, 1, 1, NULL, 'PENDING', NULL, ?)",
    ).run(deviceId, nowMs);
  }

  private bumpVersion(deviceId: string, nowMs: number): void {
    this.database.prepare(
      "UPDATE automation_config SET config_version = config_version + 1, sync_state = 'PENDING', sync_error = NULL, updated_at_ms = ? WHERE device_id = ?",
    ).run(nowMs, deviceId);
  }
}
