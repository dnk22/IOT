import type { ControlRequest, ControlResponse } from '../../types/control';
import { ApiError, isRecord, requestJson } from './client';

export async function sendManualControl(command: ControlRequest, signal?: AbortSignal): Promise<ControlResponse> {
  const payload = await requestJson('/api/control', {
    method: 'POST',
    body: JSON.stringify(command),
    signal,
  });

  if (
    !isRecord(payload) ||
    payload.success !== true ||
    typeof payload.commandId !== 'string' ||
    payload.published !== true
  ) {
    throw new ApiError('Backend trả về phản hồi điều khiển không hợp lệ.', 502, 'INVALID_CONTROL_RESPONSE');
  }
  return payload as unknown as ControlResponse;
}

export async function resumeAutomation(target: 'FAN' | 'BUZZER', signal?: AbortSignal): Promise<ControlResponse> {
  const payload = await requestJson('/api/control/resume-automation', {
    method: 'POST',
    body: JSON.stringify({ actuator: target }),
    signal,
  });
  if (!isRecord(payload) || payload.success !== true || typeof payload.commandId !== 'string' || payload.published !== true) {
    throw new ApiError('Backend trả về phản hồi điều khiển không hợp lệ.', 502, 'INVALID_CONTROL_RESPONSE');
  }
  return payload as unknown as ControlResponse;
}
