import type {
  AutomationActionState,
  AutomationActuator,
  AutomationCapabilities,
  AutomationRule,
  AutomationRuleInput,
  AutomationRuntimeState,
  AutomationSensor,
  AutomationSyncState,
  AutomationUnit,
  AutomationView,
  ComparisonOperator,
} from '../../types/automation';
import { ApiError, isRecord, requestJson } from './client';

const sensors: AutomationSensor[] = ['TEMPERATURE', 'HUMIDITY', 'LIGHT'];
const operators: ComparisonOperator[] = ['>', '>=', '<', '<='];
const actuators: AutomationActuator[] = ['FAN', 'BUZZER'];
const actions: AutomationActionState[] = ['ON', 'OFF'];
const units: AutomationUnit[] = ['°C', '%', 'ADC'];
const runtimeStates: AutomationRuntimeState[] = ['ACTIVE', 'INACTIVE', 'RELEASING', 'DISABLED', 'UNKNOWN'];
const syncStates: AutomationSyncState[] = ['PENDING', 'SYNCED', 'ERROR'];

function oneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function parseRule(value: unknown): AutomationRule {
  if (
    !isRecord(value) ||
    !isRecord(value.condition) ||
    !isRecord(value.action) ||
    typeof value.id !== 'string' ||
    typeof value.deviceId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.enabled !== 'boolean' ||
    !oneOf(value.condition.sensor, sensors) ||
    !oneOf(value.condition.operator, operators) ||
    typeof value.condition.threshold !== 'number' ||
    !Number.isFinite(value.condition.threshold) ||
    !oneOf(value.condition.unit, units) ||
    !oneOf(value.action.actuator, actuators) ||
    !oneOf(value.action.state, actions) ||
    !Number.isSafeInteger(value.createdSequence) ||
    !Number.isSafeInteger(value.createdAtMs) ||
    !Number.isSafeInteger(value.updatedAtMs) ||
    !oneOf(value.runtimeState, runtimeStates)
  ) {
    throw new ApiError('Backend trả về quy tắc Automation không hợp lệ.', 502, 'INVALID_AUTOMATION_RULE');
  }
  return value as unknown as AutomationRule;
}

function parseCapabilities(value: unknown): AutomationCapabilities {
  if (
    !isRecord(value) ||
    !Array.isArray(value.sensors) ||
    !Array.isArray(value.operators) ||
    !Array.isArray(value.actuators) ||
    typeof value.releaseConfirmMs !== 'number' ||
    typeof value.maxRules !== 'number' ||
    !Number.isSafeInteger(value.maxRules) ||
    value.maxRules < 1
  ) {
    throw new ApiError('Backend trả về khả năng Automation không hợp lệ.', 502, 'INVALID_AUTOMATION_CAPABILITIES');
  }
  const parsedSensors = value.sensors.map((item) => {
    if (!isRecord(item) || !oneOf(item.value, sensors) || typeof item.label !== 'string' || !oneOf(item.unit, units) ||
      item.inputType !== 'number' || typeof item.step !== 'number' || typeof item.min !== 'number' || typeof item.max !== 'number') {
      throw new ApiError('Backend trả về cấu hình cảm biến không hợp lệ.', 502, 'INVALID_AUTOMATION_CAPABILITIES');
    }
    return item as unknown as AutomationCapabilities['sensors'][number];
  });
  const parsedActuators = value.actuators.map((item) => {
    if (
      !isRecord(item) ||
      !oneOf(item.value, actuators) ||
      typeof item.label !== 'string' ||
      !Number.isSafeInteger(item.relayChannel) ||
      !Number.isSafeInteger(item.gpio)
      || !Array.isArray(item.actions) || !item.actions.every((action) => oneOf(action, actions))
    ) {
      throw new ApiError('Backend trả về cấu hình cơ cấu chấp hành không hợp lệ.', 502, 'INVALID_AUTOMATION_CAPABILITIES');
    }
    return item as unknown as AutomationCapabilities['actuators'][number];
  });
  if (!value.operators.every((item) => oneOf(item, operators))) {
    throw new ApiError('Backend trả về tùy chọn Automation không hợp lệ.', 502, 'INVALID_AUTOMATION_CAPABILITIES');
  }
  return {
    sensors: parsedSensors,
    operators: value.operators as ComparisonOperator[],
    actuators: parsedActuators,
    releaseConfirmMs: value.releaseConfirmMs,
    maxRules: value.maxRules,
  };
}

export function parseAutomationView(value: unknown): AutomationView {
  if (
    !isRecord(value) ||
    typeof value.deviceId !== 'string' ||
    typeof value.enabled !== 'boolean' ||
    typeof value.configVersion !== 'number' ||
    !Number.isSafeInteger(value.configVersion) ||
    !(value.appliedVersion === null || (typeof value.appliedVersion === 'number' && Number.isSafeInteger(value.appliedVersion))) ||
    !oneOf(value.syncState, syncStates) ||
    !(value.syncError === null || typeof value.syncError === 'string') ||
    typeof value.updatedAtMs !== 'number' ||
    !Number.isSafeInteger(value.updatedAtMs) ||
    !Array.isArray(value.rules)
  ) {
    throw new ApiError('Backend trả về dữ liệu Automation không hợp lệ.', 502, 'INVALID_AUTOMATION_PAYLOAD');
  }
  return {
    deviceId: value.deviceId,
    enabled: value.enabled,
    configVersion: value.configVersion,
    appliedVersion: value.appliedVersion as number | null,
    syncState: value.syncState,
    syncError: value.syncError,
    updatedAtMs: value.updatedAtMs,
    capabilities: parseCapabilities(value.capabilities),
    rules: value.rules.map(parseRule),
  };
}

async function automationRequest(path: string, init: RequestInit = {}): Promise<AutomationView> {
  return parseAutomationView(await requestJson(path, init));
}

export function getAutomation(signal?: AbortSignal): Promise<AutomationView> {
  return automationRequest('/api/automation', { signal });
}

export async function getAutomationCapabilities(signal?: AbortSignal): Promise<AutomationCapabilities> {
  return parseCapabilities(await requestJson('/api/automation/capabilities', { signal }));
}

export function createAutomationRule(input: AutomationRuleInput): Promise<AutomationView> {
  return automationRequest('/api/automation/rules', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAutomationRule(id: string, input: AutomationRuleInput): Promise<AutomationView> {
  return automationRequest('/api/automation/rules/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteAutomationRule(id: string): Promise<AutomationView> {
  return automationRequest('/api/automation/rules/' + encodeURIComponent(id), {
    method: 'DELETE',
  });
}

export function setAutomationEnabled(enabled: boolean): Promise<AutomationView> {
  return automationRequest('/api/automation/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function setAutomationRuleEnabled(id: string, enabled: boolean): Promise<AutomationView> {
  return automationRequest('/api/automation/rules/' + encodeURIComponent(id) + '/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}
