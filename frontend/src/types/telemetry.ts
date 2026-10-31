export interface TelemetryReading {
  temperatureC: number | null;
  humidityPct: number | null;
  lightRaw: number;
  temperatureEma: number | null;
  humidityEma: number | null;
  lightEma: number | null;
  dhtValid: boolean;
  uptimeMs: number;
  receivedAtMs: number;
}

export type TelemetryHistoryPoint = TelemetryReading;

export interface TelemetryHistoryResponse {
  items: TelemetryHistoryPoint[];
}

export const MAX_CHART_POINTS = 1_800;
