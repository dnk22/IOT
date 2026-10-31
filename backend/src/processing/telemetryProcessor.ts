import type { TelemetryPayload } from "../../../shared/src/types/mqtt.js";

import type { EmaState } from "../repositories/telemetryRepository.js";

export const EMA_ALPHA = 0.2;

export interface ProcessedTelemetry {
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number;
}

function nextEma(value: number, previous: number | undefined): number {
  return previous === undefined
    ? value
    : EMA_ALPHA * value + (1 - EMA_ALPHA) * previous;
}

interface InternalEmaState {
  temperatureEma?: number;
  humidityEma?: number;
  lightEma?: number;
}

export class TelemetryProcessor {
  private readonly stateByDevice = new Map<string, InternalEmaState>();

  restore(deviceId: string, state: EmaState): void {
    const restored: InternalEmaState = {};
    if (state.temperatureEma !== null) {
      restored.temperatureEma = state.temperatureEma;
    }
    if (state.humidityEma !== null) {
      restored.humidityEma = state.humidityEma;
    }
    if (state.lightEma !== null) {
      restored.lightEma = state.lightEma;
    }
    this.stateByDevice.set(deviceId, restored);
  }

  calculate(payload: TelemetryPayload): ProcessedTelemetry {
    const previous = this.stateByDevice.get(payload.deviceId) ?? {};
    const temperatureEma =
      payload.dhtValid && payload.temperatureC !== null
        ? nextEma(payload.temperatureC, previous.temperatureEma)
        : null;
    const humidityEma =
      payload.dhtValid && payload.humidityPct !== null
        ? nextEma(payload.humidityPct, previous.humidityEma)
        : null;

    return {
      temperatureEma,
      humidityEma,
      lightEma: nextEma(payload.lightRaw, previous.lightEma),
    };
  }

  commit(payload: TelemetryPayload, processed: ProcessedTelemetry): void {
    const state = this.stateByDevice.get(payload.deviceId) ?? {};
    if (processed.temperatureEma !== null) {
      state.temperatureEma = processed.temperatureEma;
    }
    if (processed.humidityEma !== null) {
      state.humidityEma = processed.humidityEma;
    }
    state.lightEma = processed.lightEma;
    this.stateByDevice.set(payload.deviceId, state);
  }
}

