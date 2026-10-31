import { availabilityTopic } from "../../../../shared/src/constants/topics.js";

import type { DevicePresenceService } from "../../services/devicePresenceService.js";
import { logger } from "../../utils/logger.js";
import type { MqttMessageHandler } from "./telemetryHandler.js";

export function createAvailabilityHandler(
  deviceId: string,
  presenceService: DevicePresenceService,
  now: () => number = Date.now,
  onOnline?: () => void,
): MqttMessageHandler {
  const expectedTopic = availabilityTopic(deviceId);
  return (topic, payload) => {
    if (topic !== expectedTopic) {
      logger.warn(`[Availability] Unexpected topic dropped: ${topic}`);
      return false;
    }
    const value = payload.toString("utf8");
    if (value !== "online" && value !== "offline") {
      logger.warn("[Availability] Invalid payload dropped.");
      return false;
    }
    presenceService.handleAvailability(
      value === "online" ? "ONLINE" : "OFFLINE",
      now(),
    );
    if (value === "online") onOnline?.();
    logger.info(`[Availability] Device ${value}.`);
    return true;
  };
}
