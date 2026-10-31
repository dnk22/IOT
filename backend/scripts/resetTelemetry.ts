import "dotenv/config";

import { resolve } from "node:path";

import { openDatabase } from "../src/database/database.js";

interface TableExistsRow {
  exists_flag: number;
}

const databasePath = resolve(
  process.cwd(),
  process.env.DATABASE_PATH?.trim() || "../database/iot-smart-room.db",
);
const database = openDatabase(databasePath);

try {
  const sensorReadingsTable = database
    .prepare<[], TableExistsRow>(`
      SELECT EXISTS(
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'sensor_readings'
      ) AS exists_flag
    `)
    .get();

  if (sensorReadingsTable?.exists_flag === 1) {
    const result = database.prepare("DELETE FROM sensor_readings").run();
    console.log(
      `[Dev session] Cleared ${result.changes} telemetry row(s) from sensor_readings.`,
    );
  } else {
    console.log(
      "[Dev session] sensor_readings does not exist yet; nothing to clear.",
    );
  }
} finally {
  database.close();
}
