import { connect, type IClientOptions, type MqttClient } from "mqtt";

import {
  availabilityTopic,
  commandAckTopic,
  configAckTopic,
  statusTopic,
  telemetryTopic,
} from "../../../shared/src/constants/topics.js";

import type { AppConfig } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { MqttMessageHandler } from "./handlers/telemetryHandler.js";

export interface MqttHandlers {
  availability: MqttMessageHandler;
  telemetry: MqttMessageHandler;
  status: MqttMessageHandler;
  commandAck: MqttMessageHandler;
  configAck: MqttMessageHandler;
}

export interface MqttPresenceObserver {
  setMqttConnected(connected: boolean): void;
  noteDeviceActivity(receivedAtMs?: number): void;
}

export function createMqttClient(
  config: AppConfig,
  handlers: MqttHandlers,
  presenceObserver: MqttPresenceObserver,
): MqttClient {
  const availability = availabilityTopic(config.deviceId);
  const telemetry = telemetryTopic(config.deviceId);
  const status = statusTopic(config.deviceId);
  const commandAck = commandAckTopic(config.deviceId);
  const configAck = configAckTopic(config.deviceId);
  const options: IClientOptions = {
    clientId: config.mqttClientId,
    username: config.mqttUsername,
    password: config.mqttPassword,
    clean: true,
    reconnectPeriod: 5_000,
    connectTimeout: 10_000,
    rejectUnauthorized: true,
    resubscribe: false,
  };

  const client = connect(
    `mqtts://${config.mqttHost}:${config.mqttPort}`,
    options,
  );
  let wasConnected = false;
  let lastErrorMessage: string | null = null;

  client.on("connect", () => {
    wasConnected = true;
    lastErrorMessage = null;
    logger.info("[MQTT] Connected.");
    presenceObserver.setMqttConnected(true);
    client.subscribe(
      [availability, telemetry, status, commandAck, configAck],
      { qos: 0 },
      (error) => {
        if (error) {
          logger.error("[MQTT] Subscription failed", error);
          return;
        }
        logger.info(
          `[MQTT] Subscribed to ${availability}, ${telemetry}, ${status}, ${commandAck}, and ${configAck}.`,
        );
      },
    );
  });

  client.on("message", (topic, payload) => {
    try {
      let validDeviceActivity = false;
      if (topic === availability) {
        handlers.availability(topic, payload);
      } else if (topic === telemetry) {
        validDeviceActivity = handlers.telemetry(topic, payload);
      } else if (topic === status) {
        handlers.status(topic, payload);
      } else if (topic === commandAck) {
        validDeviceActivity = handlers.commandAck(topic, payload);
      } else if (topic === configAck) {
        validDeviceActivity = handlers.configAck(topic, payload);
      } else {
        logger.warn(`[MQTT] Unexpected topic dropped: ${topic}`);
      }
      if (validDeviceActivity) {
        presenceObserver.noteDeviceActivity();
      }
    } catch (error) {
      logger.error("[MQTT] Message handling failed", error);
    }
  });

  client.on("reconnect", () => {
    presenceObserver.setMqttConnected(false);
    lastErrorMessage = null;
    logger.info("[MQTT] Reconnecting...");
  });
  client.on("close", () => {
    presenceObserver.setMqttConnected(false);
    if (wasConnected) {
      wasConnected = false;
      logger.warn("[MQTT] Connection closed.");
    }
  });
  client.on("offline", () => {
    presenceObserver.setMqttConnected(false);
    logger.warn("[MQTT] Client offline.");
  });
  client.on("error", (error) => {
    if (!client.connected) {
      presenceObserver.setMqttConnected(false);
    }
    if (error.message !== lastErrorMessage) {
      lastErrorMessage = error.message;
      logger.error("[MQTT] Client error", error);
    }
  });

  return client;
}
