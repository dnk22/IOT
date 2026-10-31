#pragma once

#include <Arduino.h>

namespace MqttTopics {

inline String telemetryTopic(const char* deviceId) {
  return String("iot/") + deviceId + "/telemetry";
}

inline String statusTopic(const char* deviceId) {
  return String("iot/") + deviceId + "/status";
}

inline String availabilityTopic(const char* deviceId) {
  return String("iot/") + deviceId + "/availability";
}

inline String commandTopic(const char* deviceId) {
  return String("iot/") + deviceId + "/command";
}

inline String commandAckTopic(const char* deviceId) {
  return commandTopic(deviceId) + "/ack";
}

inline String configTopic(const char* deviceId) {
  return String("iot/") + deviceId + "/config";
}

inline String configAckTopic(const char* deviceId) {
  return configTopic(deviceId) + "/ack";
}

}  // namespace MqttTopics
