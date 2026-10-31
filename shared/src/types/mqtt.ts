export interface TelemetryPayload {
  schemaVersion: 1;
  deviceId: string;
  temperatureC: number | null;
  humidityPct: number | null;
  lightRaw: number;
  dhtValid: boolean;
  uptimeMs: number;
}

export interface StatusPayload {
  schemaVersion: 1;
  deviceId: string;
  wifiSsid?: string | null;
  ipAddress?: string | null;
  wifiRssiDbm: number;
  uptimeMs: number;
  firmwareVersion: string;
  fanOn: boolean;
  buzzerOn: boolean;
  fanSource: ControlSource;
  buzzerSource: ControlSource;
  fanManualOverride: boolean;
  buzzerManualOverride: boolean;
  fanActiveRuleId: string | null;
  buzzerActiveRuleId: string | null;
  automationConfigVersion: number;
  automationEnabled: boolean;
  ruleStates: AutomationRuleRuntimeStatus[];
}

export interface ManualCommandPayload {
  schemaVersion: 1;
  commandId: string;
  mode: "MANUAL";
  target: AutomationActuator;
  fanOn: boolean;
  buzzerOn: boolean;
}

export interface ResumeAutomationCommandPayload {
  schemaVersion: 1;
  commandId: string;
  mode: "RESUME_AUTOMATION";
  target: AutomationActuator;
}

export type CommandPayload = ManualCommandPayload | ResumeAutomationCommandPayload;

interface CommandAckBase {
  schemaVersion: 1;
  deviceId: string;
  commandId: string;
  success: boolean;
}

export interface CommandSuccessAckPayload extends CommandAckBase {
  success: true;
  fanOn: boolean;
  buzzerOn: boolean;
}

export interface CommandFailureAckPayload extends CommandAckBase {
  success: false;
  error: string;
}

export type CommandAckPayload =
  | CommandSuccessAckPayload
  | CommandFailureAckPayload;

export interface DeviceConfigPayload {
  schemaVersion: 1;
  deviceId: string;
  configVersion: number;
  automationEnabled: boolean;
  rules: AutomationConfigRule[];
}

export type AutomationSensor = "TEMPERATURE" | "HUMIDITY" | "LIGHT";
export type AutomationOperator = ">" | ">=" | "<" | "<=";
export type AutomationActuator = "FAN" | "BUZZER";
export type AutomationAction = "ON" | "OFF";
export type AutomationUnit = "°C" | "%" | "ADC";
export type ControlSource = "MANUAL_BASE" | "MANUAL_OVERRIDE" | "AUTOMATION";
export type DevicePresence = "ONLINE" | "OFFLINE" | "UNKNOWN";
export type AutomationRuleRuntimeState = "DISABLED" | "INACTIVE" | "ACTIVE" | "RELEASING";

export interface AutomationRuleRuntimeStatus {
  id: string;
  state: AutomationRuleRuntimeState;
}

export interface AutomationConfigRule {
  id: string;
  name: string;
  enabled: boolean;
  sensor: AutomationSensor;
  operator: AutomationOperator;
  threshold: number;
  unit: AutomationUnit;
  actuator: AutomationActuator;
  action: AutomationAction;
  createdSequence: number;
}

interface ConfigAckBase {
  schemaVersion: 1;
  deviceId: string;
  configVersion: number;
  success: boolean;
}

export interface ConfigSuccessAckPayload extends ConfigAckBase {
  success: true;
}

export interface ConfigFailureAckPayload extends ConfigAckBase {
  success: false;
  error: string;
}

export type ConfigAckPayload =
  | ConfigSuccessAckPayload
  | ConfigFailureAckPayload;
