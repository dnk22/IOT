import { createServer } from "node:http";
import { resolve } from "node:path";

import cors, { type CorsOptions } from "cors";
import express from "express";

import { createApiRouter } from "./api/routes/index.js";
import { loadConfig } from "./config/env.js";
import { openDatabase } from "./database/database.js";
import { initializeSchema } from "./database/schema.js";
import { createCommandAckHandler } from "./mqtt/handlers/commandAckHandler.js";
import { createConfigAckHandler } from "./mqtt/handlers/configAckHandler.js";
import { createAvailabilityHandler } from "./mqtt/handlers/availabilityHandler.js";
import { createStatusHandler } from "./mqtt/handlers/statusHandler.js";
import { createTelemetryHandler } from "./mqtt/handlers/telemetryHandler.js";
import { createMqttClient } from "./mqtt/mqttClient.js";
import { TelemetryProcessor } from "./processing/telemetryProcessor.js";
import { StatusRepository } from "./repositories/statusRepository.js";
import { AutomationRepository } from "./repositories/automationRepository.js";
import { TelemetryRepository } from "./repositories/telemetryRepository.js";
import { StatusService } from "./services/statusService.js";
import { ControlService } from "./services/controlService.js";
import { TelemetryService } from "./services/telemetryService.js";
import { AutomationService } from "./services/automationService.js";
import { DevicePresenceService } from "./services/devicePresenceService.js";
import { logger } from "./utils/logger.js";
import { WebSocketHub } from "./websocket/webSocketHub.js";

const corsOptions: CorsOptions = {
  // Reflect the requesting origin so the debug page also works from file://,
  // Live Server, Vite, or the backend's own static server.
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Accept", "Content-Type"],
  optionsSuccessStatus: 204,
};

function startApplication(): void {
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  initializeSchema(database);

  const telemetryRepository = new TelemetryRepository(
    database,
    config.maxTelemetryRows,
  );
  const statusRepository = new StatusRepository(database);
  const automationRepository = new AutomationRepository(database);

  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.static(resolve(process.cwd(), "public")));

  const httpServer = createServer(app);
  const webSocketHub = new WebSocketHub(httpServer);
  const presenceService = new DevicePresenceService(
    config.deviceId,
    config.deviceOfflineTimeoutMs,
    statusRepository,
    webSocketHub,
  );
  const telemetryProcessor = new TelemetryProcessor();
  const telemetryService = new TelemetryService(
    config.deviceId,
    telemetryRepository,
    telemetryProcessor,
    webSocketHub,
  );
  let automationService: AutomationService | null = null;
  const statusService = new StatusService(
    config.deviceId,
    statusRepository,
    presenceService,
    {
      handleReportedConfigVersion(version): void {
        automationService?.handleReportedConfigVersion(version);
      },
    },
  );

  telemetryService.restoreEmaState();

  const mqttClient = createMqttClient(config, {
    availability: createAvailabilityHandler(
      config.deviceId,
      presenceService,
      Date.now,
      () => { void automationService?.publishCurrentConfiguration(); },
    ),
    telemetry: createTelemetryHandler(config.deviceId, telemetryService),
    status: createStatusHandler(config.deviceId, statusService),
    commandAck: createCommandAckHandler(config.deviceId, webSocketHub),
    configAck: createConfigAckHandler(config.deviceId, {
      handleAck(ack): void {
        automationService?.handleAck(ack);
      },
    }),
  }, presenceService);
  const controlService = new ControlService(mqttClient, config.deviceId);
  automationService = new AutomationService(
    config.deviceId,
    automationRepository,
    presenceService,
    mqttClient,
    webSocketHub,
  );
  app.use(
    "/api",
    createApiRouter(
      telemetryRepository,
      presenceService,
      config.deviceId,
      controlService,
      automationService,
    ),
  );

  void automationService.publishCurrentConfiguration();
  presenceService.start();

  httpServer.listen(config.port, () => {
    logger.info(`[HTTP] Listening on port ${config.port}.`);
  });

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info("[App] Shutting down.");
    presenceService.dispose();
    mqttClient.end(true);
    webSocketHub.close();
    httpServer.close(() => {
      database.close();
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

try {
  startApplication();
} catch (error) {
  logger.error("[App] Startup failed", error);
  process.exitCode = 1;
}
