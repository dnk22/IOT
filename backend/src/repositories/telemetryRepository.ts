import type Database from "better-sqlite3";

import type { SqliteDatabase } from "../database/database.js";

export interface TelemetryRecord {
  deviceId: string;
  schemaVersion: 1;
  temperatureC: number | null;
  humidityPct: number | null;
  lightRaw: number;
  dhtValid: boolean;
  uptimeMs: number;
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number;
  receivedAtMs: number;
}

export interface TelemetryView {
  temperatureC: number | null;
  humidityPct: number | null;
  lightRaw: number;
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number;
  dhtValid: boolean;
  uptimeMs: number;
  receivedAtMs: number;
}

export interface EmaState {
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number | null;
}

interface TelemetryInsertParameters {
  deviceId: string;
  schemaVersion: number;
  temperatureC: number | null;
  humidityPct: number | null;
  lightRaw: number;
  dhtValid: number;
  uptimeMs: number;
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number;
  receivedAtMs: number;
}

interface TelemetryRow {
  temperature_c: number | null;
  humidity_pct: number | null;
  light_raw: number;
  temperature_ema: number | null;
  humidity_ema: number | null;
  light_ema: number;
  dht_valid: number;
  uptime_ms: number;
  received_at_ms: number;
}

interface EmaStateRow {
  temperature_ema: number | null;
  humidity_ema: number | null;
  light_ema: number | null;
}

interface HistoryParameters {
  deviceId: string;
  fromMs: number;
  toMs: number;
  limit: number;
}

interface RecentParameters {
  deviceId: string;
  limit: number;
}

interface CountRow {
  count: number;
}

export const DEFAULT_MAX_TELEMETRY_ROWS = 10_000;
const DEFAULT_RETENTION_CHECK_INTERVAL = 100;

export interface HistoryQuery {
  fromMs: number;
  toMs: number;
  limit: number;
}

function mapTelemetryRow(row: TelemetryRow): TelemetryView {
  return {
    temperatureC: row.temperature_c,
    humidityPct: row.humidity_pct,
    lightRaw: row.light_raw,
    temperatureEma: row.temperature_ema,
    humidityEma: row.humidity_ema,
    lightEma: row.light_ema,
    dhtValid: row.dht_valid === 1,
    uptimeMs: row.uptime_ms,
    receivedAtMs: row.received_at_ms,
  };
}

export class TelemetryRepository {
  private readonly insertStatement: Database.Statement<TelemetryInsertParameters>;
  private readonly latestStatement: Database.Statement<[string], TelemetryRow>;
  private readonly historyStatement: Database.Statement<
    HistoryParameters,
    TelemetryRow
  >;
  private readonly recentStatement: Database.Statement<
    RecentParameters,
    TelemetryRow
  >;
  private readonly countStatement: Database.Statement<[], CountRow>;
  private readonly deleteOldestStatement: Database.Statement<[number]>;
  private readonly emaStateStatement: Database.Statement<
    [string, string, string],
    EmaStateRow
  >;

  private insertsSinceRetentionCheck = 0;

  constructor(
    database: SqliteDatabase,
    private readonly maxRows = DEFAULT_MAX_TELEMETRY_ROWS,
    private readonly retentionCheckInterval = DEFAULT_RETENTION_CHECK_INTERVAL,
  ) {
    if (!Number.isSafeInteger(maxRows) || maxRows <= 0) {
      throw new Error("maxRows must be a positive integer");
    }
    if (!Number.isSafeInteger(retentionCheckInterval) || retentionCheckInterval <= 0) {
      throw new Error("retentionCheckInterval must be a positive integer");
    }
    this.insertStatement = database.prepare<TelemetryInsertParameters>(`
      INSERT INTO sensor_readings (
        device_id, schema_version, temperature_c, humidity_pct, light_raw,
        dht_valid, uptime_ms, temperature_ema, humidity_ema, light_ema,
        received_at_ms
      ) VALUES (
        @deviceId, @schemaVersion, @temperatureC, @humidityPct, @lightRaw,
        @dhtValid, @uptimeMs, @temperatureEma, @humidityEma, @lightEma,
        @receivedAtMs
      )
    `);

    this.latestStatement = database.prepare<[string], TelemetryRow>(`
      SELECT temperature_c, humidity_pct, light_raw, temperature_ema,
             humidity_ema, light_ema, dht_valid, uptime_ms, received_at_ms
      FROM sensor_readings
      WHERE device_id = ?
      ORDER BY received_at_ms DESC, id DESC
      LIMIT 1
    `);

    this.historyStatement = database.prepare<HistoryParameters, TelemetryRow>(`
      SELECT temperature_c, humidity_pct, light_raw, temperature_ema,
             humidity_ema, light_ema, dht_valid, uptime_ms, received_at_ms
      FROM (
        SELECT id, temperature_c, humidity_pct, light_raw, temperature_ema,
               humidity_ema, light_ema, dht_valid, uptime_ms, received_at_ms
        FROM sensor_readings
        WHERE device_id = @deviceId
          AND received_at_ms >= @fromMs
          AND received_at_ms <= @toMs
        ORDER BY received_at_ms DESC, id DESC
        LIMIT @limit
      )
      ORDER BY received_at_ms ASC, id ASC
    `);

    this.recentStatement = database.prepare<RecentParameters, TelemetryRow>(`
      SELECT temperature_c, humidity_pct, light_raw, temperature_ema,
             humidity_ema, light_ema, dht_valid, uptime_ms, received_at_ms
      FROM (
        SELECT id, temperature_c, humidity_pct, light_raw, temperature_ema,
               humidity_ema, light_ema, dht_valid, uptime_ms, received_at_ms
        FROM sensor_readings
        WHERE device_id = @deviceId
        ORDER BY received_at_ms DESC, id DESC
        LIMIT @limit
      )
      ORDER BY received_at_ms ASC, id ASC
    `);

    this.countStatement = database.prepare<[], CountRow>(`
      SELECT COUNT(*) AS count FROM sensor_readings
    `);
    this.deleteOldestStatement = database.prepare<[number]>(`
      DELETE FROM sensor_readings
      WHERE id IN (
        SELECT id FROM sensor_readings
        ORDER BY received_at_ms ASC, id ASC
        LIMIT ?
      )
    `);

    this.emaStateStatement = database.prepare<
      [string, string, string],
      EmaStateRow
    >(`
      SELECT
        (
          SELECT temperature_ema FROM sensor_readings
          WHERE device_id = ? AND temperature_ema IS NOT NULL
          ORDER BY received_at_ms DESC, id DESC LIMIT 1
        ) AS temperature_ema,
        (
          SELECT humidity_ema FROM sensor_readings
          WHERE device_id = ? AND humidity_ema IS NOT NULL
          ORDER BY received_at_ms DESC, id DESC LIMIT 1
        ) AS humidity_ema,
        (
          SELECT light_ema FROM sensor_readings
          WHERE device_id = ? AND light_ema IS NOT NULL
          ORDER BY received_at_ms DESC, id DESC LIMIT 1
        ) AS light_ema
    `);

    this.pruneOldestRows();
  }

  insert(record: TelemetryRecord): void {
    this.insertStatement.run({
      ...record,
      dhtValid: record.dhtValid ? 1 : 0,
    });
    this.insertsSinceRetentionCheck += 1;
    if (this.insertsSinceRetentionCheck >= this.retentionCheckInterval) {
      this.insertsSinceRetentionCheck = 0;
      this.pruneOldestRows();
    }
  }

  findLatest(deviceId: string): TelemetryView | null {
    const row = this.latestStatement.get(deviceId);
    return row ? mapTelemetryRow(row) : null;
  }

  findHistory(deviceId: string, query: HistoryQuery): TelemetryView[] {
    return this.historyStatement
      .all({ deviceId, ...query })
      .map(mapTelemetryRow);
  }

  findRecent(deviceId: string, limit: number): TelemetryView[] {
    return this.recentStatement.all({ deviceId, limit }).map(mapTelemetryRow);
  }

  findLatestEmaState(deviceId: string): EmaState {
    const row = this.emaStateStatement.get(deviceId, deviceId, deviceId);
    return {
      temperatureEma: row?.temperature_ema ?? null,
      humidityEma: row?.humidity_ema ?? null,
      lightEma: row?.light_ema ?? null,
    };
  }

  private pruneOldestRows(): void {
    const count = this.countStatement.get()?.count ?? 0;
    const overflow = count - this.maxRows;
    if (overflow > 0) {
      this.deleteOldestStatement.run(overflow);
    }
  }
}
