import { MAX_CHART_POINTS, type TelemetryHistoryPoint, type TelemetryReading } from '../../types/telemetry';
import { ApiError, isRecord, requestJson } from './client';

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function parseTelemetry(value: unknown): TelemetryReading {
  if (
    !isRecord(value) ||
    !isNullableFiniteNumber(value.temperatureC) ||
    !isNullableFiniteNumber(value.humidityPct) ||
    typeof value.lightRaw !== 'number' ||
    !Number.isInteger(value.lightRaw) ||
    value.lightRaw < 0 ||
    value.lightRaw > 4095 ||
    !isNullableFiniteNumber(value.temperatureEma) ||
    !isNullableFiniteNumber(value.humidityEma) ||
    !isNullableFiniteNumber(value.lightEma) ||
    typeof value.dhtValid !== 'boolean' ||
    typeof value.uptimeMs !== 'number' ||
    !Number.isFinite(value.uptimeMs) ||
    value.uptimeMs < 0 ||
    typeof value.receivedAtMs !== 'number' ||
    !Number.isSafeInteger(value.receivedAtMs) ||
    value.receivedAtMs < 0
  ) {
    throw new ApiError('Backend trả về dữ liệu cảm biến không hợp lệ.', 502, 'INVALID_TELEMETRY_PAYLOAD');
  }
  return value as unknown as TelemetryReading;
}

export async function getLatestTelemetry(signal?: AbortSignal): Promise<TelemetryReading> {
  return parseTelemetry(await requestJson('/api/telemetry/latest', { signal }));
}

export async function getRecentTelemetry(
  limit = MAX_CHART_POINTS,
  signal?: AbortSignal,
): Promise<TelemetryHistoryPoint[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const payload = await requestJson(`/api/telemetry/recent?${params.toString()}`, { signal });

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ApiError('Backend trả về dữ liệu cảm biến gần nhất không hợp lệ.', 502, 'INVALID_RECENT_PAYLOAD');
  }

  const items = payload.items.map(parseTelemetry).sort((left, right) => left.receivedAtMs - right.receivedAtMs);
  return items;
}
