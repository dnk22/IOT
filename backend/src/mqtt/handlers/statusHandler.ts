import { statusTopic } from "../../../../shared/src/constants/topics.js";

import type { StatusService } from "../../services/statusService.js";
import { logger } from "../../utils/logger.js";
import type { MqttMessageHandler } from "./telemetryHandler.js";

export function createStatusHandler(
  deviceId: string,
  service: StatusService,
): MqttMessageHandler {
  const expectedTopic = statusTopic(deviceId);

  return (topic, payload) => {
    const receivedAtMs = Date.now();
    if (topic !== expectedTopic) {
      logger.warn(`[Status] Unexpected topic dropped: ${topic}`);
      return false;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      logger.warn("[Status] Malformed JSON dropped.");
      return false;
    }

    return service.handle(decoded, deviceId, receivedAtMs) !== null;
  };
}
