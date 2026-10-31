import type { SqliteDatabase } from "./database.js";

interface TableInfoRow {
  name: string;
}

function addDeviceStatusColumns(database: SqliteDatabase): void {
  const columns = new Set(
    database
      .prepare<[], TableInfoRow>("PRAGMA table_info(device_status)")
      .all()
      .map((column) => column.name),
  );

  if (!columns.has("mode")) {
    database.exec("ALTER TABLE device_status ADD COLUMN mode TEXT");
  }
  if (!columns.has("fan_on")) {
    database.exec("ALTER TABLE device_status ADD COLUMN fan_on INTEGER");
  }
  if (!columns.has("buzzer_on")) {
    database.exec("ALTER TABLE device_status ADD COLUMN buzzer_on INTEGER");
  }
  if (!columns.has("wifi_ssid")) {
    database.exec("ALTER TABLE device_status ADD COLUMN wifi_ssid TEXT");
  }
  if (!columns.has("ip_address")) {
    database.exec("ALTER TABLE device_status ADD COLUMN ip_address TEXT");
  }
  if (!columns.has("fan_source")) {
    database.exec("ALTER TABLE device_status ADD COLUMN fan_source TEXT");
  }
  if (!columns.has("buzzer_source")) {
    database.exec("ALTER TABLE device_status ADD COLUMN buzzer_source TEXT");
  }
  if (!columns.has("fan_active_rule_id")) {
    database.exec("ALTER TABLE device_status ADD COLUMN fan_active_rule_id TEXT");
  }
  if (!columns.has("buzzer_active_rule_id")) {
    database.exec("ALTER TABLE device_status ADD COLUMN buzzer_active_rule_id TEXT");
  }
  if (!columns.has("automation_config_version")) {
    database.exec(
      "ALTER TABLE device_status ADD COLUMN automation_config_version INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columns.has("fan_manual_override")) {
    database.exec("ALTER TABLE device_status ADD COLUMN fan_manual_override INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.has("buzzer_manual_override")) {
    database.exec("ALTER TABLE device_status ADD COLUMN buzzer_manual_override INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.has("automation_enabled")) {
    database.exec("ALTER TABLE device_status ADD COLUMN automation_enabled INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.has("rule_states_json")) {
    database.exec("ALTER TABLE device_status ADD COLUMN rule_states_json TEXT NOT NULL DEFAULT '[]'");
  }
}

export function initializeSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      temperature_c REAL,
      humidity_pct REAL,
      light_raw INTEGER NOT NULL,
      dht_valid INTEGER NOT NULL,
      uptime_ms INTEGER NOT NULL,
      temperature_ema REAL,
      humidity_ema REAL,
      light_ema REAL,
      received_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_time
    ON sensor_readings(device_id, received_at_ms DESC);

    CREATE TABLE IF NOT EXISTS device_status (
      device_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      online INTEGER NOT NULL,
      wifi_ssid TEXT,
      ip_address TEXT,
      wifi_rssi_dbm INTEGER,
      uptime_ms INTEGER NOT NULL,
      firmware_version TEXT,
      mode TEXT,
      fan_on INTEGER,
      buzzer_on INTEGER,
      fan_source TEXT,
      buzzer_source TEXT,
      fan_active_rule_id TEXT,
      buzzer_active_rule_id TEXT,
      automation_config_version INTEGER NOT NULL DEFAULT 0,
      fan_manual_override INTEGER NOT NULL DEFAULT 0,
      buzzer_manual_override INTEGER NOT NULL DEFAULT 0,
      automation_enabled INTEGER NOT NULL DEFAULT 0,
      rule_states_json TEXT NOT NULL DEFAULT '[]',
      last_seen_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_config (
      device_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      config_version INTEGER NOT NULL DEFAULT 1,
      applied_version INTEGER,
      sync_state TEXT NOT NULL DEFAULT 'PENDING',
      sync_error TEXT,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      sensor TEXT NOT NULL,
      operator TEXT NOT NULL,
      threshold REAL NOT NULL,
      unit TEXT NOT NULL,
      actuator TEXT NOT NULL,
      action TEXT NOT NULL,
      created_sequence INTEGER NOT NULL,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      UNIQUE(device_id, created_sequence),
      FOREIGN KEY(device_id) REFERENCES automation_config(device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_automation_rules_device_sequence
    ON automation_rules(device_id, created_sequence ASC);
  `);

  addDeviceStatusColumns(database);
  database.prepare("UPDATE automation_config SET sync_state = 'SYNCED' WHERE sync_state = 'APPLIED'").run();
}
