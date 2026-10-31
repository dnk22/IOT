export interface ControlRequest {
  target: 'FAN' | 'BUZZER';
  fanOn: boolean;
  buzzerOn: boolean;
}

export interface ControlResponse {
  success: true;
  commandId: string;
  published: true;
}
