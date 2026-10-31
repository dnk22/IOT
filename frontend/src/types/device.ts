export interface DeviceStatus {
  deviceId: string;
  online: boolean;
  presence: DevicePresence;
  mqttConnected: boolean;
  wifiSsid: string | null;
  ipAddress: string | null;
  wifiRssiDbm: number | null;
  uptimeMs: number;
  firmwareVersion: string | null;
  fanOn: boolean | null;
  buzzerOn: boolean | null;
  fanSource: ControlSource | null;
  buzzerSource: ControlSource | null;
  fanManualOverride: boolean;
  buzzerManualOverride: boolean;
  fanActiveRuleId: string | null;
  buzzerActiveRuleId: string | null;
  automationConfigVersion: number;
  automationEnabled: boolean;
  ruleStates: Array<{ id: string; state: 'DISABLED' | 'INACTIVE' | 'ACTIVE' | 'RELEASING' }>;
  lastSeenAtMs: number;
}

export type ActuatorName = 'fan' | 'buzzer';
export type ControlSource = 'MANUAL_BASE' | 'MANUAL_OVERRIDE' | 'AUTOMATION';
export type DevicePresence = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface ActuatorState {
  id: ActuatorName;
  name: string;
  relayChannel: number;
  gpio: number;
  idleLabel: string;
  activeLabel: string;
}
