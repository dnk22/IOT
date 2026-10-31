import { telemetryTopic } from "../../../../shared/src/constants/topics.js";

import type { TelemetryService } from "../../services/telemetryService.js";
import { logger } from "../../utils/logger.js";

export type MqttMessageHandler = (topic: string, payload: Buffer) => boolean;

export function createTelemetryHandler(
  deviceId: string,
  service: TelemetryService,
): MqttMessageHandler {
  const expectedTopic = telemetryTopic(deviceId);

  return (topic, payload) => {
    const receivedAtMs = Date.now();
    if (topic !== expectedTopic) {
      logger.warn(`[Telemetry] Unexpected topic dropped: ${topic}`);
      return false;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(payload.toString("utf8")) as unknown;
    } catch {
      logger.warn("[Telemetry] Malformed JSON dropped.");
      return false;
    }

    return service.handle(decoded, deviceId, receivedAtMs) !== null;
  };
}
