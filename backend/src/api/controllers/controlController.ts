import type { RequestHandler } from "express";

import type { AutomationActuator } from "../../../../shared/src/types/mqtt.js";

import {
  CommandPublishError,
  MqttUnavailableError,
} from "../../services/controlService.js";

export interface ManualControlPublisher {
  publishManualControl(
    target: AutomationActuator,
    fanOn: boolean,
    buzzerOn: boolean,
  ): Promise<{ commandId: string; published: true }>;
  publishResumeAutomation(
    target: AutomationActuator,
  ): Promise<{ commandId: string; published: true }>;
}

export function createResumeAutomationController(
  publisher: ManualControlPublisher,
): RequestHandler {
  return async (request, response) => {
    if (!request.is("application/json")) {
      response.status(415).json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type phải là application/json." } });
      return;
    }
    if (!isObject(request.body) || !(request.body.actuator === "FAN" || request.body.actuator === "BUZZER")) {
      response.status(400).json({ error: { code: "INVALID_ACTUATOR", message: "actuator phải là FAN hoặc BUZZER." } });
      return;
    }
    try {
      const published = await publisher.publishResumeAutomation(request.body.actuator);
      response.status(202).json({ success: true, ...published });
    } catch (error) {
      if (error instanceof MqttUnavailableError || error instanceof CommandPublishError) {
        response.status(503).json({ error: { code: "MQTT_UNAVAILABLE", message: "Không thể gửi lệnh qua MQTT." } });
        return;
      }
      throw error;
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidManualControlBody(
  value: unknown,
): value is { target: AutomationActuator; fanOn: boolean; buzzerOn: boolean } {
  return (
    isObject(value) &&
    (value.target === "FAN" || value.target === "BUZZER") &&
    typeof value.fanOn === "boolean" &&
    typeof value.buzzerOn === "boolean"
  );
}

export function createControlController(
  publisher: ManualControlPublisher,
): RequestHandler {
  return async (request, response) => {
    if (!request.is("application/json")) {
      response.status(415).json({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type phải là application/json.",
        },
      });
      return;
    }

    if (!isValidManualControlBody(request.body)) {
      response.status(400).json({
        error: {
          code: "INVALID_CONTROL_BODY",
          message: "target phải là FAN hoặc BUZZER; fanOn và buzzerOn phải là kiểu boolean.",
        },
      });
      return;
    }

    try {
      const published = await publisher.publishManualControl(
        request.body.target,
        request.body.fanOn,
        request.body.buzzerOn,
      );
      response.status(202).json({ success: true, ...published });
    } catch (error) {
      if (
        error instanceof MqttUnavailableError ||
        error instanceof CommandPublishError
      ) {
        response.status(503).json({
          error: {
            code: "MQTT_UNAVAILABLE",
            message: "Không thể gửi lệnh qua MQTT.",
          },
        });
        return;
      }
      throw error;
    }
  };
}
