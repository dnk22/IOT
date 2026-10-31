import { commandAckTopic } from "../../../../shared/src/constants/topics.js";
import type { CommandAckPayload } from "../../../../shared/src/types/mqtt.js";

import { logger } from "../../utils/logger.js";
import type { MqttMessageHandler } from "./telemetryHandler.js";

export interface CommandAckBroadcaster {
  broadcastCommandAck(data: CommandAckPayload): void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidCommandAck(
  value: unknown,
  deviceId: string,
): value is CommandAckPayload {
  if (
    !isObject(value) ||
    value.schemaVersion !== 1 ||
    value.deviceId !== deviceId ||
    typeof value.commandId !== "string" ||
    value.commandId.length === 0 ||
    typeof value.success !== "boolean"
  ) {
    return false;
  }

  if (value.success) {
    return (
      typeof value.fanOn === "boolean" &&
      typeof value.buzzerOn === "boolean"
    );
  }

  return typeof value.error === "string" && value.error.length > 0;
}

export function createCommandAckHandler(
  deviceId: string,
  broadcaster: CommandAckBroadcaster,
): MqttMessageHandler {
  const expectedTopic = commandAckTopic(deviceId);

  return (topic, payload) => {
    if (topic !== expectedTopic) {
      logger.warn(`[Command ACK] Unexpected topic dropped: ${topic}`);
      return false;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      logger.warn("[Command ACK] Malformed JSON dropped.");
      return false;
    }

    if (!isValidCommandAck(decoded, deviceId)) {
      logger.warn("[Command ACK] Invalid payload dropped.");
      return false;
    }

    logger.info(
      `[Command ACK] ${decoded.commandId}: ${decoded.success ? "success" : decoded.error}`,
    );
    broadcaster.broadcastCommandAck(decoded);
    return true;
  };
}
