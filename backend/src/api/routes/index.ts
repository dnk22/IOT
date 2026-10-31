import { Router } from "express";

import type { AutomationService } from "../../services/automationService.js";
import type { DevicePresenceService } from "../../services/devicePresenceService.js";
import type { TelemetryRepository } from "../../repositories/telemetryRepository.js";
import type { ManualControlPublisher } from "../controllers/controlController.js";
import { createControlController, createResumeAutomationController } from "../controllers/controlController.js";
import {
  createLatestTelemetryController,
  createRecentTelemetryController,
  createTelemetryHistoryController,
} from "../controllers/telemetryController.js";
import { createStatusController } from "../controllers/statusController.js";
import {
  createCreateRuleController,
  createDeleteRuleController,
  createGetAutomationController,
  createGetAutomationCapabilitiesController,
  createSetAutomationEnabledController,
  createSetRuleEnabledController,
  createUpdateRuleController,
} from "../controllers/automationController.js";

export function createApiRouter(
  telemetryRepository: TelemetryRepository,
  presenceService: DevicePresenceService,
  deviceId: string,
  controlPublisher: ManualControlPublisher,
  automationService: AutomationService,
): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  router.get(
    "/telemetry/latest",
    createLatestTelemetryController(telemetryRepository, deviceId),
  );
  router.get(
    "/telemetry/recent",
    createRecentTelemetryController(telemetryRepository, deviceId),
  );
  router.get(
    "/telemetry/history",
    createTelemetryHistoryController(telemetryRepository, deviceId),
  );
  router.get("/status", createStatusController(presenceService));
  router.post("/control", createControlController(controlPublisher));
  router.post(
    "/control/resume-automation",
    createResumeAutomationController(controlPublisher),
  );
  router.get("/automation", createGetAutomationController(automationService));
  router.get(
    "/automation/capabilities",
    createGetAutomationCapabilitiesController(automationService),
  );
  router.patch(
    "/automation/enabled",
    createSetAutomationEnabledController(automationService),
  );
  router.post(
    "/automation/rules",
    createCreateRuleController(automationService),
  );
  router.put(
    "/automation/rules/:id",
    createUpdateRuleController(automationService),
  );
  router.delete(
    "/automation/rules/:id",
    createDeleteRuleController(automationService),
  );
  router.patch(
    "/automation/rules/:id/enabled",
    createSetRuleEnabledController(automationService),
  );

  return router;
}
