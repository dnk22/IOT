import type { RequestHandler } from "express";

import type { DevicePresenceService } from "../../services/devicePresenceService.js";
import { sendInternalError } from "./responses.js";

export function createStatusController(
  presenceService: DevicePresenceService,
): RequestHandler {
  return (_request, response) => {
    try {
      response.json(presenceService.getView());
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}
