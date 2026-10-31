import type {
  AutomationAction,
  AutomationActuator,
  AutomationOperator,
  AutomationSensor,
  AutomationUnit,
} from "../../../shared/src/types/mqtt.js";

export interface SensorCapability {
  value: AutomationSensor;
  label: string;
  unit: AutomationUnit;
  inputType: "number";
  step: number;
  min: number;
  max: number;
}

export interface ActuatorCapability {
  value: AutomationActuator;
  label: string;
  relayChannel: number;
  gpio: number;
  actions: AutomationAction[];
}

export interface AutomationCapabilities {
  sensors: SensorCapability[];
  operators: AutomationOperator[];
  actuators: ActuatorCapability[];
  releaseConfirmMs: number;
  maxRules: number;
}

export const automationCapabilities: AutomationCapabilities = {
  sensors: [
    { value: "TEMPERATURE", label: "Nhiệt độ", unit: "°C", inputType: "number", step: 0.1, min: -40, max: 80 },
    { value: "HUMIDITY", label: "Độ ẩm", unit: "%", inputType: "number", step: 0.1, min: 0, max: 100 },
    { value: "LIGHT", label: "Ánh sáng", unit: "ADC", inputType: "number", step: 1, min: 0, max: 4095 },
  ],
  operators: [">", ">=", "<", "<="],
  actuators: [
    { value: "FAN", label: "Quạt", relayChannel: 1, gpio: 25, actions: ["ON", "OFF"] },
    { value: "BUZZER", label: "Còi", relayChannel: 2, gpio: 26, actions: ["ON", "OFF"] },
  ],
  releaseConfirmMs: 5000,
  maxRules: 16,
};

export function sensorCapability(sensor: unknown): SensorCapability | undefined {
  return automationCapabilities.sensors.find((candidate) => candidate.value === sensor);
}

export function isAutomationOperator(value: unknown): value is AutomationOperator {
  return automationCapabilities.operators.some((candidate) => candidate === value);
}

export function actuatorCapability(actuator: unknown): ActuatorCapability | undefined {
  return automationCapabilities.actuators.find((candidate) => candidate.value === actuator);
}
