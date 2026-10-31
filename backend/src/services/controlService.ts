import { randomUUID } from "node:crypto";

import type { MqttClient } from "mqtt";

import { commandTopic } from "../../../shared/src/constants/topics.js";
import type {
  AutomationActuator,
  CommandPayload,
} from "../../../shared/src/types/mqtt.js";

export interface PublishedCommand {
  commandId: string;
  published: true;
}

export class MqttUnavailableError extends Error {}
export class CommandPublishError extends Error {}

export class ControlService {
  constructor(
    private readonly mqttClient: MqttClient,
    private readonly deviceId: string,
  ) {}

  async publishManualControl(
    target: AutomationActuator,
    fanOn: boolean,
    buzzerOn: boolean,
  ): Promise<PublishedCommand> {
    if (!this.mqttClient.connected) {
      throw new MqttUnavailableError("MQTT chưa kết nối.");
    }

    const commandId = randomUUID();
    const command: CommandPayload = {
      schemaVersion: 1,
      commandId,
      mode: "MANUAL",
      target,
      fanOn,
      buzzerOn,
    };

    await new Promise<void>((resolve, reject) => {
      this.mqttClient.publish(
        commandTopic(this.deviceId),
        JSON.stringify(command),
        { qos: 0 },
        (error) => {
          if (error) {
            reject(new CommandPublishError(error.message));
            return;
          }
          resolve();
        },
      );
    });

    return { commandId, published: true };
  }

  async publishResumeAutomation(target: AutomationActuator): Promise<PublishedCommand> {
    if (!this.mqttClient.connected) {
      throw new MqttUnavailableError("MQTT chưa kết nối.");
    }
    const commandId = randomUUID();
    const command: CommandPayload = {
      schemaVersion: 1,
      commandId,
      mode: "RESUME_AUTOMATION",
      target,
    };
    await new Promise<void>((resolve, reject) => {
      this.mqttClient.publish(
        commandTopic(this.deviceId),
        JSON.stringify(command),
        { qos: 0 },
        (error) => error ? reject(new CommandPublishError(error.message)) : resolve(),
      );
    });
    return { commandId, published: true };
  }
}
