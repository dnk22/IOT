import type { TelemetryPayload } from "../../../shared/src/types/mqtt.js";

import type { TelemetryProcessor } from "../processing/telemetryProcessor.js";
import type {
  TelemetryRecord,
  TelemetryRepository,
  TelemetryView,
} from "../repositories/telemetryRepository.js";
import { logger } from "../utils/logger.js";

const MIN_TEMPERATURE_C = -40;
const MAX_TEMPERATURE_C = 80;
const MIN_HUMIDITY_PCT = 0;
const MAX_HUMIDITY_PCT = 100;
const MIN_LIGHT_RAW = 0;
const MAX_LIGHT_RAW = 4095;

export interface TelemetryBroadcaster {
  broadcastTelemetry(data: TelemetryView): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isValidTelemetryPayload(
  value: unknown,
  configuredDeviceId: string,
  topicDeviceId: string,
): value is TelemetryPayload {
  if (!isObject(value)) {
    return false;
  }

  if (
    value.schemaVersion !== 1 ||
    typeof value.deviceId !== "string" ||
    value.deviceId.length === 0 ||
    value.deviceId !== configuredDeviceId ||
    value.deviceId !== topicDeviceId ||
    !isNumberOrNull(value.temperatureC) ||
    !isNumberOrNull(value.humidityPct) ||
    !Number.isInteger(value.lightRaw) ||
    (value.lightRaw as number) < MIN_LIGHT_RAW ||
    (value.lightRaw as number) > MAX_LIGHT_RAW ||
    typeof value.dhtValid !== "boolean" ||
    typeof value.uptimeMs !== "number" ||
    !Number.isFinite(value.uptimeMs) ||
    value.uptimeMs < 0
  ) {
    return false;
  }

  if (!value.dhtValid) {
    return value.temperatureC === null && value.humidityPct === null;
  }

  return (
    typeof value.temperatureC === "number" &&
    value.temperatureC >= MIN_TEMPERATURE_C &&
    value.temperatureC <= MAX_TEMPERATURE_C &&
    typeof value.humidityPct === "number" &&
    value.humidityPct >= MIN_HUMIDITY_PCT &&
    value.humidityPct <= MAX_HUMIDITY_PCT
  );
}

export class TelemetryService {
  constructor(
    private readonly deviceId: string,
    private readonly repository: TelemetryRepository,
    private readonly processor: TelemetryProcessor,
    private readonly broadcaster: TelemetryBroadcaster,
  ) {}

  restoreEmaState(): void {
    this.processor.restore(
      this.deviceId,
      this.repository.findLatestEmaState(this.deviceId),
    );
  }

  handle(
    payload: unknown,
    topicDeviceId: string,
    receivedAtMs: number,
  ): TelemetryView | null {
    if (!isValidTelemetryPayload(payload, this.deviceId, topicDeviceId)) {
      logger.warn("[Telemetry] Invalid payload dropped.");
      return null;
    }

    const processed = this.processor.calculate(payload);
    const record: TelemetryRecord = {
      ...payload,
      ...processed,
      receivedAtMs,
    };

    try {
      this.repository.insert(record);
    } catch (error) {
      logger.error("[Telemetry] Persistence failed", error);
      return null;
    }

    this.processor.commit(payload, processed);

    const view: TelemetryView = {
      temperatureC: record.temperatureC,
      humidityPct: record.humidityPct,
      lightRaw: record.lightRaw,
      temperatureEma: record.temperatureEma,
      humidityEma: record.humidityEma,
      lightEma: record.lightEma,
      dhtValid: record.dhtValid,
      uptimeMs: record.uptimeMs,
      receivedAtMs: record.receivedAtMs,
    };
    this.broadcaster.broadcastTelemetry(view);
    return view;
  }
}

