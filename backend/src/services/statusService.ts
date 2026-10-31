import type { StatusPayload } from "../../../shared/src/types/mqtt.js";

import type {
  StatusRecord,
  StatusRepository,
  StatusView,
} from "../repositories/statusRepository.js";
import { logger } from "../utils/logger.js";

export interface StatusUpdateConsumer {
  statusUpdated(receivedAtMs: number): StatusView;
}

export interface AppliedConfigConsumer {
  handleReportedConfigVersion(configVersion: number): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNetworkString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isControlSource(value: unknown): boolean {
  return value === "MANUAL_BASE" || value === "MANUAL_OVERRIDE" || value === "AUTOMATION";
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isRuleStates(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) =>
    isObject(item) && typeof item.id === "string" && item.id.length > 0 &&
    (item.state === "DISABLED" || item.state === "INACTIVE" ||
      item.state === "ACTIVE" || item.state === "RELEASING"));
}

export function isValidStatusPayload(
  value: unknown,
  configuredDeviceId: string,
  topicDeviceId: string,
): value is StatusPayload {
  return (
    isObject(value) &&
    value.schemaVersion === 1 &&
    typeof value.deviceId === "string" &&
    value.deviceId.length > 0 &&
    value.deviceId === configuredDeviceId &&
    value.deviceId === topicDeviceId &&
    isOptionalNetworkString(value.wifiSsid) &&
    isOptionalNetworkString(value.ipAddress) &&
    typeof value.wifiRssiDbm === "number" &&
    Number.isFinite(value.wifiRssiDbm) &&
    typeof value.uptimeMs === "number" &&
    Number.isSafeInteger(value.uptimeMs) &&
    value.uptimeMs >= 0 &&
    typeof value.firmwareVersion === "string" &&
    value.firmwareVersion.length > 0 &&
    typeof value.fanOn === "boolean" &&
    typeof value.buzzerOn === "boolean" &&
    isControlSource(value.fanSource) &&
    isControlSource(value.buzzerSource) &&
    typeof value.fanManualOverride === "boolean" &&
    typeof value.buzzerManualOverride === "boolean" &&
    isNullableString(value.fanActiveRuleId) &&
    isNullableString(value.buzzerActiveRuleId) &&
    Number.isSafeInteger(value.automationConfigVersion) &&
    (value.automationConfigVersion as number) >= 0 &&
    typeof value.automationEnabled === "boolean" &&
    isRuleStates(value.ruleStates)
  );
}

export class StatusService {
  constructor(
    private readonly deviceId: string,
    private readonly repository: StatusRepository,
    private readonly statusUpdates: StatusUpdateConsumer,
    private readonly appliedConfig?: AppliedConfigConsumer,
  ) {}

  handle(
    payload: unknown,
    topicDeviceId: string,
    receivedAtMs: number,
  ): StatusView | null {
    if (!isValidStatusPayload(payload, this.deviceId, topicDeviceId)) {
      logger.warn("[Status] Invalid payload dropped.");
      return null;
    }

    const record: StatusRecord = {
      ...payload,
      // The database column is retained for backward compatibility only.
      // Public presence is computed from availability/MQTT/lastSeen.
      online: true,
      wifiSsid: payload.wifiSsid ?? null,
      ipAddress: payload.ipAddress ?? null,
      lastSeenAtMs: receivedAtMs,
    };

    try {
      this.repository.upsert(record);
      this.appliedConfig?.handleReportedConfigVersion(payload.automationConfigVersion);
    } catch (error) {
      logger.error("[Status] Persistence failed", error);
      return null;
    }

    return this.statusUpdates.statusUpdated(receivedAtMs);
  }
}
