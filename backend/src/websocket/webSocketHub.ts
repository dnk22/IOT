import type { Server } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import type { CommandAckPayload } from "../../../shared/src/types/mqtt.js";
import type { StatusView } from "../repositories/statusRepository.js";
import type { TelemetryView } from "../repositories/telemetryRepository.js";
import type { AutomationView } from "../services/automationService.js";
import { logger } from "../utils/logger.js";

export class WebSocketHub {
  private readonly server: WebSocketServer;

  constructor(httpServer: Server) {
    this.server = new WebSocketServer({ server: httpServer, path: "/ws" });
    this.server.on("connection", (socket) => {
      socket.on("error", (error) => {
        logger.error("[WebSocket] Client error", error);
      });
    });
    this.server.on("listening", () => {
      logger.info("[WebSocket] Listening on /ws");
    });
  }

  broadcastTelemetry(data: TelemetryView): void {
    this.broadcast({ type: "telemetry", data });
  }

  broadcastStatus(data: StatusView): void {
    this.broadcast({ type: "status", data });
  }

  broadcastCommandAck(data: CommandAckPayload): void {
    this.broadcast({ type: "commandAck", data });
  }

  broadcastAutomation(data: AutomationView): void {
    this.broadcast({ type: "automation", data });
  }

  close(): void {
    for (const client of this.server.clients) {
      client.terminate();
    }
    this.server.close();
  }

  private broadcast(message: object): void {
    const serialized = JSON.stringify(message);
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(serialized, (error) => {
            if (error) {
              logger.error("[WebSocket] Broadcast failed", error);
            }
          });
        } catch (error) {
          logger.error("[WebSocket] Broadcast failed", error);
        }
      }
    }
  }
}
