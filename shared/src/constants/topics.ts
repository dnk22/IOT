const TOPIC_ROOT = "iot";

export const TELEMETRY_SUBSCRIPTION_TOPIC = `${TOPIC_ROOT}/+/telemetry`;
export const STATUS_SUBSCRIPTION_TOPIC = `${TOPIC_ROOT}/+/status`;

export function telemetryTopic(deviceId: string): string {
  return `${TOPIC_ROOT}/${deviceId}/telemetry`;
}

export function statusTopic(deviceId: string): string {
  return `${TOPIC_ROOT}/${deviceId}/status`;
}

export function availabilityTopic(deviceId: string): string {
  return `${TOPIC_ROOT}/${deviceId}/availability`;
}

export function commandTopic(deviceId: string): string {
  return `${TOPIC_ROOT}/${deviceId}/command`;
}

export function commandAckTopic(deviceId: string): string {
  return `${commandTopic(deviceId)}/ack`;
}

export function configTopic(deviceId: string): string {
  return `${TOPIC_ROOT}/${deviceId}/config`;
}

export function configAckTopic(deviceId: string): string {
  return `${configTopic(deviceId)}/ack`;
}
