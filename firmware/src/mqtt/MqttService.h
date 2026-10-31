#pragma once

#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <cstdint>

#include "models/Models.h"

class ActuatorService;
class AutomationService;
class WifiService;

class MqttService {
 public:
  MqttService(ActuatorService& actuatorService,
              AutomationService& automationService,
              WifiService& wifiService);

  void begin();
  void loop(bool wifiConnected);

  bool isConnected();
  std::uint8_t consecutiveFailureCount() const;
  bool publishTelemetry(const SensorReading& reading);
  bool publishStatus();
  void disconnectGracefully();

 private:
  void attemptConnection();
  bool publishAvailability(const char* payload);
  void handleMessage(char* topic, std::uint8_t* payload,
                     unsigned int length);
  void handleCommand(std::uint8_t* payload, unsigned int length);
  void handleConfig(std::uint8_t* payload, unsigned int length);
  void rejectCommand(const char* errorCode, const char* commandId = nullptr);
  bool publishCommandAck(const char* commandId, bool success,
                         const char* errorCode = nullptr);
  bool publishConfigAck(std::uint32_t configVersion, bool success,
                        const char* errorCode = nullptr);

  ActuatorService& actuatorService_;
  AutomationService& automationService_;
  WifiService& wifiService_;
  WiFiClient plainClient_;
  WiFiClientSecure secureClient_;
  PubSubClient mqttClient_;
  std::uint32_t lastConnectionAttemptMs_ = 0;
  std::uint8_t consecutiveFailureCount_ = 0;
  bool hasAttemptedConnection_ = false;
  bool transportReady_ = false;
};
