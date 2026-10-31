import type { DeviceStatus } from './device';
import type { TelemetryReading } from './telemetry';
import type { AutomationView } from './automation';

export type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected';

export type WebSocketMessage =
  | { type: 'telemetry'; data: TelemetryReading }
  | { type: 'status'; data: DeviceStatus }
  | { type: 'automation'; data: AutomationView };
