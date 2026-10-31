import type { RequestHandler } from "express";

import type {
  AutomationAction,
  AutomationActuator,
  AutomationOperator,
  AutomationSensor,
  AutomationUnit,
} from "../../../../shared/src/types/mqtt.js";
import type { AutomationRuleWrite } from "../../repositories/automationRepository.js";
import {
  AutomationLimitError,
  type AutomationService,
} from "../../services/automationService.js";
import { sendInternalError, sendNotFound } from "./responses.js";
import {
  actuatorCapability,
  isAutomationOperator,
  sensorCapability,
} from "../../automation/capabilities.js";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unitForSensor(sensor: AutomationSensor): AutomationUnit {
  if (sensor === "TEMPERATURE") return "°C";
  if (sensor === "HUMIDITY") return "%";
  return "ADC";
}

export function parseRuleBody(value: unknown): AutomationRuleWrite | null {
  if (!isObject(value) || !isObject(value.condition) || !isObject(value.action)) {
    return null;
  }
  const sensor = value.condition.sensor;
  const operator = value.condition.operator;
  const threshold = value.condition.threshold;
  const actuator = value.action.actuator;
  const action = value.action.state;
  if (
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    value.name.trim().length > 80 ||
    typeof value.enabled !== "boolean" ||
    !sensorCapability(sensor) ||
    !isAutomationOperator(operator) ||
    typeof threshold !== "number" ||
    !Number.isFinite(threshold) ||
    !actuatorCapability(actuator) ||
    !actuatorCapability(actuator)?.actions.some((candidate) => candidate === action)
  ) {
    return null;
  }
  const capability = sensorCapability(sensor);
  if (!capability || threshold < capability.min || threshold > capability.max) {
    return null;
  }
  return {
    name: value.name.trim(),
    enabled: value.enabled,
    sensor: sensor as AutomationSensor,
    operator: operator as AutomationOperator,
    threshold,
    unit: unitForSensor(sensor as AutomationSensor),
    actuator: actuator as AutomationActuator,
    action: action as AutomationAction,
  };
}

function requestId(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function requireJson(handler: RequestHandler): RequestHandler {
  return async (request, response, next) => {
    if (!request.is("application/json")) {
      response.status(415).json({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type phải là application/json.",
        },
      });
      return;
    }
    await handler(request, response, next);
  };
}

function invalidRule(response: Parameters<RequestHandler>[1]): void {
  response.status(400).json({
    error: {
      code: "INVALID_AUTOMATION_RULE",
      message: "name, enabled, condition và action phải dùng các giá trị Automation được hỗ trợ.",
    },
  });
}

export function createGetAutomationController(service: AutomationService): RequestHandler {
  return (_request, response) => {
    try {
      response.json(service.getView());
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}

export function createGetAutomationCapabilitiesController(service: AutomationService): RequestHandler {
  return (_request, response) => {
    response.json(service.getCapabilities());
  };
}

export function createCreateRuleController(service: AutomationService): RequestHandler {
  return requireJson(async (request, response) => {
    const write = parseRuleBody(request.body);
    if (!write) {
      invalidRule(response);
      return;
    }
    try {
      response.status(201).json(await service.createRule(write));
    } catch (error) {
      if (error instanceof AutomationLimitError) {
        response.status(409).json({
          error: { code: "AUTOMATION_RULE_LIMIT", message: error.message },
        });
        return;
      }
      sendInternalError(response, error);
    }
  });
}

export function createUpdateRuleController(service: AutomationService): RequestHandler {
  return requireJson(async (request, response) => {
    const write = parseRuleBody(request.body);
    if (!write) {
      invalidRule(response);
      return;
    }
    try {
      const view = await service.updateRule(requestId(request.params.id), write);
      if (!view) {
        sendNotFound(response, "Không tìm thấy quy tắc Automation.");
        return;
      }
      response.json(view);
    } catch (error) {
      sendInternalError(response, error);
    }
  });
}

export function createDeleteRuleController(service: AutomationService): RequestHandler {
  return async (request, response) => {
    try {
      const view = await service.deleteRule(requestId(request.params.id));
      if (!view) {
        sendNotFound(response, "Không tìm thấy quy tắc Automation.");
        return;
      }
      response.json(view);
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}

function parseEnabled(value: unknown): boolean | null {
  return isObject(value) && typeof value.enabled === "boolean" ? value.enabled : null;
}

export function createSetRuleEnabledController(service: AutomationService): RequestHandler {
  return requireJson(async (request, response) => {
    const enabled = parseEnabled(request.body);
    if (enabled === null) {
      response.status(400).json({
        error: { code: "INVALID_ENABLED_STATE", message: "enabled phải là kiểu boolean." },
      });
      return;
    }
    try {
      const view = await service.setRuleEnabled(requestId(request.params.id), enabled);
      if (!view) {
        sendNotFound(response, "Không tìm thấy quy tắc Automation.");
        return;
      }
      response.json(view);
    } catch (error) {
      sendInternalError(response, error);
    }
  });
}

export function createSetAutomationEnabledController(service: AutomationService): RequestHandler {
  return requireJson(async (request, response) => {
    const enabled = parseEnabled(request.body);
    if (enabled === null) {
      response.status(400).json({
        error: { code: "INVALID_ENABLED_STATE", message: "enabled phải là kiểu boolean." },
      });
      return;
    }
    try {
      response.json(await service.setAutomationEnabled(enabled));
    } catch (error) {
      sendInternalError(response, error);
    }
  });
}
