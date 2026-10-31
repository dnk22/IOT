import { configAckTopic } from "../../../../shared/src/constants/topics.js";
import type { ConfigAckPayload } from "../../../../shared/src/types/mqtt.js";

import { logger } from "../../utils/logger.js";
import type { MqttMessageHandler } from "./telemetryHandler.js";

export interface ConfigAckConsumer {
  handleAck(ack: ConfigAckPayload): unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidConfigAck(value: unknown, deviceId: string): value is ConfigAckPayload {
  if (
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    value.deviceId !== deviceId ||
    !Number.isSafeInteger(value.configVersion) ||
    (value.configVersion as number) < 1 ||
    typeof value.success !== "boolean"
  ) {
    return false;
  }
  return value.success || (typeof value.error === "string" && value.error.length > 0);
}

export function createConfigAckHandler(
  deviceId: string,
  consumer: ConfigAckConsumer,
): MqttMessageHandler {
  const expectedTopic = configAckTopic(deviceId);
  return (topic, payload) => {
    if (topic !== expectedTopic) {
      logger.warn("[Config ACK] Unexpected topic dropped: " + topic);
      return false;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      logger.warn("[Config ACK] Malformed JSON dropped.");
      return false;
    }
    if (!isValidConfigAck(decoded, deviceId)) {
      logger.warn("[Config ACK] Invalid payload dropped.");
      return false;
    }
    consumer.handleAck(decoded);
    logger.info(
      "[Config ACK] Version " + decoded.configVersion + ": " +
      (decoded.success ? "applied" : decoded.error),
    );
    return true;
  };
}
