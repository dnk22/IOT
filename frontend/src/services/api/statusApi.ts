import type { DeviceStatus } from '../../types/device';
import { ApiError, isRecord, requestJson } from './client';

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function isNullableControlSource(value: unknown): boolean {
  return value === null || value === 'MANUAL_BASE' || value === 'MANUAL_OVERRIDE' || value === 'AUTOMATION';
}

function isRuleStates(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === 'string' &&
    (item.state === 'DISABLED' || item.state === 'INACTIVE' || item.state === 'ACTIVE' || item.state === 'RELEASING'));
}

export function parseDeviceStatus(value: unknown): DeviceStatus {
  if (
    !isRecord(value) ||
    typeof value.deviceId !== 'string' ||
    typeof value.online !== 'boolean' ||
    !(value.presence === 'ONLINE' || value.presence === 'OFFLINE' || value.presence === 'UNKNOWN') ||
    typeof value.mqttConnected !== 'boolean' ||
    !isNullableString(value.wifiSsid) ||
    !isNullableString(value.ipAddress) ||
    !(value.wifiRssiDbm === null || (typeof value.wifiRssiDbm === 'number' && Number.isFinite(value.wifiRssiDbm))) ||
    typeof value.uptimeMs !== 'number' ||
    !Number.isSafeInteger(value.uptimeMs) ||
    value.uptimeMs < 0 ||
    !isNullableString(value.firmwareVersion) ||
    !isNullableBoolean(value.fanOn) ||
    !isNullableBoolean(value.buzzerOn) ||
    !isNullableControlSource(value.fanSource) ||
    !isNullableControlSource(value.buzzerSource) ||
    typeof value.fanManualOverride !== 'boolean' ||
    typeof value.buzzerManualOverride !== 'boolean' ||
    !isNullableString(value.fanActiveRuleId) ||
    !isNullableString(value.buzzerActiveRuleId) ||
    typeof value.automationConfigVersion !== 'number' ||
    !Number.isSafeInteger(value.automationConfigVersion) ||
    value.automationConfigVersion < 0 ||
    typeof value.automationEnabled !== 'boolean' ||
    !isRuleStates(value.ruleStates) ||
    typeof value.lastSeenAtMs !== 'number' ||
    !Number.isSafeInteger(value.lastSeenAtMs) ||
    value.lastSeenAtMs < 0
  ) {
    throw new ApiError('Backend trả về trạng thái thiết bị không hợp lệ.', 502, 'INVALID_STATUS_PAYLOAD');
  }
  return value as unknown as DeviceStatus;
}

export async function getDeviceStatus(signal?: AbortSignal): Promise<DeviceStatus> {
  return parseDeviceStatus(await requestJson('/api/status', { signal }));
}
