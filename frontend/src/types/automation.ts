export type AutomationSensor = 'TEMPERATURE' | 'HUMIDITY' | 'LIGHT';
export type ComparisonOperator = '>=' | '>' | '<=' | '<';
export type AutomationActuator = 'FAN' | 'BUZZER';
export type AutomationActionState = 'ON' | 'OFF';
export type AutomationUnit = '°C' | '%' | 'ADC';
export type AutomationRuntimeState = 'ACTIVE' | 'INACTIVE' | 'RELEASING' | 'DISABLED' | 'UNKNOWN';
export type AutomationSyncState = 'PENDING' | 'SYNCED' | 'ERROR';

export interface AutomationCondition {
  sensor: AutomationSensor;
  operator: ComparisonOperator;
  threshold: number;
  unit: AutomationUnit;
}

export interface AutomationAction {
  actuator: AutomationActuator;
  state: AutomationActionState;
}

export interface AutomationRule {
  id: string;
  deviceId: string;
  name: string;
  enabled: boolean;
  condition: AutomationCondition;
  action: AutomationAction;
  createdSequence: number;
  createdAtMs: number;
  updatedAtMs: number;
  runtimeState: AutomationRuntimeState;
}

export interface AutomationCapabilities {
  sensors: Array<{
    value: AutomationSensor;
    label: string;
    unit: AutomationUnit;
    inputType: 'number';
    step: number;
    min: number;
    max: number;
  }>;
  operators: ComparisonOperator[];
  actuators: Array<{
    value: AutomationActuator;
    label: string;
    relayChannel: number;
    gpio: number;
    actions: AutomationActionState[];
  }>;
  releaseConfirmMs: number;
  maxRules: number;
}

export interface AutomationView {
  deviceId: string;
  enabled: boolean;
  configVersion: number;
  appliedVersion: number | null;
  syncState: AutomationSyncState;
  syncError: string | null;
  updatedAtMs: number;
  capabilities: AutomationCapabilities;
  rules: AutomationRule[];
}

export interface AutomationRuleInput {
  name: string;
  enabled: boolean;
  condition: {
    sensor: AutomationSensor;
    operator: ComparisonOperator;
    threshold: number;
  };
  action: AutomationAction;
}
