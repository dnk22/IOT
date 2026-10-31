import { randomUUID } from "node:crypto";

import type { MqttClient } from "mqtt";

import { configTopic } from "../../../shared/src/constants/topics.js";
import type {
  AutomationConfigRule,
  ConfigAckPayload,
  DeviceConfigPayload,
} from "../../../shared/src/types/mqtt.js";
import type {
  AutomationConfigurationRecord,
  AutomationRepository,
  AutomationRuleRecord,
  AutomationRuleWrite,
} from "../repositories/automationRepository.js";
import type { StatusView } from "../repositories/statusRepository.js";
import { logger } from "../utils/logger.js";
import {
  automationCapabilities,
  type AutomationCapabilities,
} from "../automation/capabilities.js";

export type RuleRuntimeState = "ACTIVE" | "INACTIVE" | "RELEASING" | "DISABLED" | "UNKNOWN";

export interface AutomationRuleView {
  id: string;
  deviceId: string;
  name: string;
  enabled: boolean;
  condition: {
    sensor: AutomationRuleRecord["sensor"];
    operator: AutomationRuleRecord["operator"];
    threshold: number;
    unit: AutomationRuleRecord["unit"];
  };
  action: {
    actuator: AutomationRuleRecord["actuator"];
    state: AutomationRuleRecord["action"];
  };
  createdSequence: number;
  createdAtMs: number;
  updatedAtMs: number;
  runtimeState: RuleRuntimeState;
}

export interface AutomationView {
  deviceId: string;
  enabled: boolean;
  configVersion: number;
  appliedVersion: number | null;
  syncState: "PENDING" | "SYNCED" | "ERROR";
  syncError: string | null;
  updatedAtMs: number;
  capabilities: AutomationCapabilities;
  rules: AutomationRuleView[];
}

export interface AutomationBroadcaster {
  broadcastAutomation(data: AutomationView): void;
}

export interface AutomationStatusSource {
  findByDeviceId(deviceId: string): StatusView | null;
}

export class AutomationLimitError extends Error {}

export class AutomationService {
  constructor(
    private readonly deviceId: string,
    private readonly repository: AutomationRepository,
    private readonly statusRepository: AutomationStatusSource,
    private readonly mqttClient: MqttClient,
    private readonly broadcaster: AutomationBroadcaster,
  ) {
    this.mqttClient.on("connect", () => {
      void this.publishCurrentConfiguration();
    });
  }

  getView(): AutomationView {
    return this.toView(
      this.repository.getConfiguration(this.deviceId),
      this.statusRepository.findByDeviceId(this.deviceId),
    );
  }

  getCapabilities(): AutomationCapabilities {
    return automationCapabilities;
  }

  async createRule(write: AutomationRuleWrite): Promise<AutomationView> {
    const current = this.repository.getConfiguration(this.deviceId);
    if (current.rules.length >= automationCapabilities.maxRules) {
      throw new AutomationLimitError("Đã đạt số lượng quy tắc Automation tối đa.");
    }
    const updated = this.repository.createRule(
      this.deviceId,
      randomUUID(),
      write,
      Date.now(),
    );
    return this.afterMutation(updated);
  }

  async updateRule(id: string, write: AutomationRuleWrite): Promise<AutomationView | null> {
    const updated = this.repository.updateRule(this.deviceId, id, write, Date.now());
    return updated ? this.afterMutation(updated) : null;
  }

  async deleteRule(id: string): Promise<AutomationView | null> {
    const updated = this.repository.deleteRule(this.deviceId, id, Date.now());
    return updated ? this.afterMutation(updated) : null;
  }

  async setRuleEnabled(id: string, enabled: boolean): Promise<AutomationView | null> {
    const updated = this.repository.setRuleEnabled(this.deviceId, id, enabled, Date.now());
    return updated ? this.afterMutation(updated) : null;
  }

  async setAutomationEnabled(enabled: boolean): Promise<AutomationView> {
    return this.afterMutation(
      this.repository.setAutomationEnabled(this.deviceId, enabled, Date.now()),
    );
  }

  handleAck(ack: ConfigAckPayload): AutomationView {
    const updated = this.repository.recordAck(
      this.deviceId,
      ack.configVersion,
      ack.success,
      ack.success ? null : ack.error,
      Date.now(),
    );
    const view = this.toView(updated, this.statusRepository.findByDeviceId(this.deviceId));
    this.broadcaster.broadcastAutomation(view);
    return view;
  }

  handleReportedConfigVersion(configVersion: number): void {
    const current = this.repository.getConfiguration(this.deviceId);
    if (configVersion !== current.configVersion ||
        (current.appliedVersion === configVersion && current.syncState === "SYNCED")) {
      return;
    }
    const updated = this.repository.recordAck(
      this.deviceId,
      configVersion,
      true,
      null,
      Date.now(),
    );
    this.broadcaster.broadcastAutomation(
      this.toView(updated, this.statusRepository.findByDeviceId(this.deviceId)),
    );
  }

  async publishCurrentConfiguration(): Promise<boolean> {
    const configuration = this.repository.getConfiguration(this.deviceId);
    if (!this.mqttClient.connected) {
      this.repository.markPending(this.deviceId, "MQTT_DISCONNECTED", Date.now());
      this.broadcaster.broadcastAutomation(this.getView());
      return false;
    }

    const payload = this.toMqttPayload(configuration);
    try {
      await new Promise<void>((resolve, reject) => {
        this.mqttClient.publish(
          configTopic(this.deviceId),
          JSON.stringify(payload),
          { qos: 1, retain: true },
          (error) => error ? reject(error) : resolve(),
        );
      });
      logger.info("[Automation] Published config version " + configuration.configVersion + ".");
      return true;
    } catch (error) {
      this.repository.markPending(
        this.deviceId,
        error instanceof Error ? error.message : "MQTT_PUBLISH_FAILED",
        Date.now(),
      );
      this.broadcaster.broadcastAutomation(this.getView());
      logger.error("[Automation] Config publish failed", error);
      return false;
    }
  }

  private async afterMutation(configuration: AutomationConfigurationRecord): Promise<AutomationView> {
    const view = this.toView(configuration, this.statusRepository.findByDeviceId(this.deviceId));
    this.broadcaster.broadcastAutomation(view);
    await this.publishCurrentConfiguration();
    return this.getView();
  }

  private toMqttPayload(configuration: AutomationConfigurationRecord): DeviceConfigPayload {
    const rules: AutomationConfigRule[] = configuration.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      sensor: rule.sensor,
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit,
      actuator: rule.actuator,
      action: rule.action,
      createdSequence: rule.createdSequence,
    }));
    return {
      schemaVersion: 1,
      deviceId: this.deviceId,
      configVersion: configuration.configVersion,
      automationEnabled: configuration.enabled,
      rules,
    };
  }

  private toView(
    configuration: AutomationConfigurationRecord,
    status: StatusView | null,
  ): AutomationView {
    const runtimeKnown =
      status?.online === true &&
      status.automationConfigVersion === configuration.configVersion;
    const rules = configuration.rules.map((rule): AutomationRuleView => {
      let runtimeState: RuleRuntimeState = "UNKNOWN";
      if (!configuration.enabled || !rule.enabled) {
        runtimeState = "DISABLED";
      } else if (runtimeKnown) {
        runtimeState = status?.ruleStates.find((candidate) => candidate.id === rule.id)?.state ?? "UNKNOWN";
      }
      return {
        id: rule.id,
        deviceId: rule.deviceId,
        name: rule.name,
        enabled: rule.enabled,
        condition: {
          sensor: rule.sensor,
          operator: rule.operator,
          threshold: rule.threshold,
          unit: rule.unit,
        },
        action: {
          actuator: rule.actuator,
          state: rule.action,
        },
        createdSequence: rule.createdSequence,
        createdAtMs: rule.createdAtMs,
        updatedAtMs: rule.updatedAtMs,
        runtimeState,
      };
    });

    return {
      deviceId: configuration.deviceId,
      enabled: configuration.enabled,
      configVersion: configuration.configVersion,
      appliedVersion: configuration.appliedVersion,
      syncState: configuration.syncState,
      syncError: configuration.syncError,
      updatedAtMs: configuration.updatedAtMs,
      capabilities: automationCapabilities,
      rules,
    };
  }
}
