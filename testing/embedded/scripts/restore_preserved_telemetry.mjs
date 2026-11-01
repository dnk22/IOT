#!/usr/bin/env node
/** Merge pre-test telemetry rows back after an accidental dev-session reset. */

import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(new URL("../../../backend/package.json", import.meta.url));
const Database = require("better-sqlite3");

const livePath = resolve(process.argv[2]);
const preservedPath = resolve(process.argv[3]);
const preRestoreBackup = resolve(process.argv[4]);
const evidencePath = resolve(process.argv[5]);
const database = new Database(livePath, { fileMustExist: true });

const before = database.prepare("SELECT COUNT(*) AS count FROM sensor_readings").get().count;
await database.backup(preRestoreBackup);
database.prepare("ATTACH DATABASE ? AS preserved").run(preservedPath);
const preservedCount = database
  .prepare("SELECT COUNT(*) AS count FROM preserved.sensor_readings")
  .get().count;

const inserted = database.transaction(() =>
  database.prepare(`
    INSERT OR IGNORE INTO sensor_readings
    SELECT * FROM preserved.sensor_readings
  `).run().changes,
)();

const missing = database.prepare(`
  SELECT COUNT(*) AS count FROM (
    SELECT * FROM preserved.sensor_readings
    EXCEPT
    SELECT * FROM main.sensor_readings
  )
`).get().count;
const after = database.prepare("SELECT COUNT(*) AS count FROM sensor_readings").get().count;
database.prepare("DETACH DATABASE preserved").run();
database.close();

const evidence = {
  at: new Date().toISOString(),
  method: "INSERT OR IGNORE by preserved primary key; no live rows deleted",
  before,
  preservedCount,
  inserted,
  after,
  missingPreservedRows: missing,
  status: inserted === preservedCount && missing === 0 ? "PASS" : "FAIL",
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify(evidence));
process.exitCode = evidence.status === "PASS" ? 0 : 1;
