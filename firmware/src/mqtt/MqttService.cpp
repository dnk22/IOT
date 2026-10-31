#include "mqtt/MqttService.h"

#include <ArduinoJson.h>
#include <cmath>
#include <cstring>
#include <esp_timer.h>

#include "AppConfig.h"
#include "Secrets.h"
#include "actuators/ActuatorService.h"
#include "automation/AutomationService.h"
#include "mqtt/MqttTopics.h"
#include "network/WifiService.h"

namespace {

constexpr std::size_t JSON_BUFFER_SIZE = 4096;
constexpr std::size_t MAX_COMMAND_ID_LENGTH = 64;

std::uint64_t uptimeMilliseconds() {
  return static_cast<std::uint64_t>(esp_timer_get_time()) / 1000ULL;
}

bool serializePayload(const JsonDocument& document,
                      char (&buffer)[JSON_BUFFER_SIZE]) {
  if (measureJson(document) >= JSON_BUFFER_SIZE) {
    Serial.println(F("[MQTT] JSON payload is too large."));
    return false;
  }

  serializeJson(document, buffer, JSON_BUFFER_SIZE);
  return true;
}

}  // namespace

MqttService::MqttService(ActuatorService& actuatorService,
                         AutomationService& automationService,
                         WifiService& wifiService)
    : actuatorService_(actuatorService),
      automationService_(automationService),
      wifiService_(wifiService) {
}

void MqttService::begin() {
  mqttClient_.setServer(Secrets::MQTT_HOST, Secrets::MQTT_PORT);
  mqttClient_.setSocketTimeout(AppConfig::MQTT_SOCKET_TIMEOUT_SECONDS);
  if (!mqttClient_.setBufferSize(AppConfig::MQTT_PACKET_BUFFER_SIZE)) {
    Serial.println(F("[MQTT] Failed to allocate packet buffer."));
  }
  mqttClient_.setCallback(
      [this](char* topic, std::uint8_t* payload, unsigned int length) {
        handleMessage(topic, payload, length);
      });

  if (Secrets::MQTT_USE_TLS) {
    mqttClient_.setClient(secureClient_);
    secureClient_.setHandshakeTimeout(
        AppConfig::MQTT_TLS_HANDSHAKE_TIMEOUT_SECONDS);

    if (Secrets::MQTT_CA_CERT[0] == '\0') {
      Serial.println(
          F("[MQTT] TLS enabled but MQTT_CA_CERT is not configured."));
      return;
    }

    secureClient_.setCACert(Secrets::MQTT_CA_CERT);
    transportReady_ = true;
    return;
  }

  Serial.println(F("[MQTT] WARNING: TLS is disabled by configuration."));
  mqttClient_.setClient(plainClient_);
  transportReady_ = true;
}

void MqttService::loop(bool wifiConnected) {
  if (!wifiConnected) {
    if (mqttClient_.connected()) {
      disconnectGracefully();
      Serial.println(F("[MQTT] Disconnected because Wi-Fi is unavailable."));
    }
    hasAttemptedConnection_ = false;
    return;
  }

  if (!transportReady_) {
    return;
  }

  if (mqttClient_.connected()) {
    mqttClient_.loop();
    return;
  }

  const std::uint32_t nowMs = millis();
  if (hasAttemptedConnection_ &&
      nowMs - lastConnectionAttemptMs_ <
          AppConfig::MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }

  hasAttemptedConnection_ = true;
  attemptConnection();
  // Measure the retry delay from the end of a potentially slow network call.
  lastConnectionAttemptMs_ = millis();
}

bool MqttService::isConnected() {
  return mqttClient_.connected();
}

std::uint8_t MqttService::consecutiveFailureCount() const {
  return consecutiveFailureCount_;
}

bool MqttService::publishTelemetry(const SensorReading& reading) {
  if (!isConnected()) {
    return false;
  }

  JsonDocument document;
  document["schemaVersion"] = 1;
  document["deviceId"] = AppConfig::DEVICE_ID;

  const bool dhtValid = reading.dhtValid &&
                        std::isfinite(reading.temperatureC) &&
                        std::isfinite(reading.humidityPct);
  if (dhtValid) {
    document["temperatureC"] = reading.temperatureC;
    document["humidityPct"] = reading.humidityPct;
  } else {
    document["temperatureC"] = nullptr;
    document["humidityPct"] = nullptr;
  }

  document["lightRaw"] = reading.lightRaw;
  document["dhtValid"] = dhtValid;
  document["uptimeMs"] = reading.sampledAtMs;

  char payload[JSON_BUFFER_SIZE];
  if (!serializePayload(document, payload)) {
    return false;
  }

  const String topic = MqttTopics::telemetryTopic(AppConfig::DEVICE_ID);
  const bool published = mqttClient_.publish(topic.c_str(), payload, false);
  Serial.println(published ? F("[MQTT] Telemetry published.")
                           : F("[MQTT] Telemetry publish failed."));
  return published;
}

bool MqttService::publishStatus() {
  if (!isConnected()) {
    return false;
  }

  JsonDocument document;
  document["schemaVersion"] = 1;
  document["deviceId"] = AppConfig::DEVICE_ID;
  if (wifiService_.isConnected()) {
    document["wifiSsid"] = wifiService_.getSsid();
    document["ipAddress"] = wifiService_.getIpAddress();
  } else {
    document["wifiSsid"] = nullptr;
    document["ipAddress"] = nullptr;
  }
  document["wifiRssiDbm"] = wifiService_.getRssiDbm();
  document["uptimeMs"] = uptimeMilliseconds();
  document["firmwareVersion"] = AppConfig::FIRMWARE_VERSION;
  document["fanOn"] = actuatorService_.isFanOn();
  document["buzzerOn"] = actuatorService_.isBuzzerOn();
  document["fanSource"] = automationService_.fanSource();
  document["buzzerSource"] = automationService_.buzzerSource();
  document["fanManualOverride"] = automationService_.fanManualOverride();
  document["buzzerManualOverride"] = automationService_.buzzerManualOverride();
  if (automationService_.fanActiveRuleId() == nullptr) {
    document["fanActiveRuleId"] = nullptr;
  } else {
    document["fanActiveRuleId"] = automationService_.fanActiveRuleId();
  }
  if (automationService_.buzzerActiveRuleId() == nullptr) {
    document["buzzerActiveRuleId"] = nullptr;
  } else {
    document["buzzerActiveRuleId"] =
        automationService_.buzzerActiveRuleId();
  }
  document["automationConfigVersion"] =
      automationService_.configVersion();
  document["automationEnabled"] = automationService_.automationEnabled();
  automationService_.appendRuleStates(document["ruleStates"].to<JsonArray>());

  char payload[JSON_BUFFER_SIZE];
  if (!serializePayload(document, payload)) {
    return false;
  }

  const String topic = MqttTopics::statusTopic(AppConfig::DEVICE_ID);
  const bool published = mqttClient_.publish(topic.c_str(), payload, false);
  Serial.println(published ? F("[MQTT] Status published.")
                           : F("[MQTT] Status publish failed."));
  return published;
}

bool MqttService::publishAvailability(const char* payload) {
  if (!isConnected()) {
    return false;
  }
  const String topic = MqttTopics::availabilityTopic(AppConfig::DEVICE_ID);
  return mqttClient_.publish(topic.c_str(), payload, true);
}

void MqttService::disconnectGracefully() {
  if (!mqttClient_.connected()) {
    return;
  }
  const bool published = publishAvailability("offline");
  mqttClient_.loop();
  mqttClient_.disconnect();
  Serial.println(published ? F("[MQTT] Availability offline published.")
                           : F("[MQTT] Availability offline publish failed."));
}

void MqttService::attemptConnection() {
  Serial.println(F("[MQTT] Connecting..."));
  const String clientId = String(AppConfig::DEVICE_ID) + "-client";

  const String availabilityTopic =
      MqttTopics::availabilityTopic(AppConfig::DEVICE_ID);

  if (mqttClient_.connect(clientId.c_str(), Secrets::MQTT_USERNAME,
                          Secrets::MQTT_PASSWORD,
                          availabilityTopic.c_str(), 1, true, "offline")) {
    consecutiveFailureCount_ = 0;
    Serial.println(F("[MQTT] Connected."));

    if (publishAvailability("online")) {
      Serial.println(F("[MQTT] Availability online published."));
    } else {
      Serial.println(F("[MQTT] Availability online publish failed."));
    }

    if (AppConfig::ENABLE_MQTT_CONTROL) {
      const String commandTopic =
          MqttTopics::commandTopic(AppConfig::DEVICE_ID);
      const String configTopic =
          MqttTopics::configTopic(AppConfig::DEVICE_ID);
      if (mqttClient_.subscribe(commandTopic.c_str()) &&
          mqttClient_.subscribe(configTopic.c_str())) {
        Serial.print(F("[MQTT] Subscribed to "));
        Serial.print(commandTopic);
        Serial.print(F(" and "));
        Serial.println(configTopic);
      } else {
        Serial.println(F("[MQTT] Command subscription failed."));
      }
    }
    return;
  }

  if (consecutiveFailureCount_ < 255) {
    ++consecutiveFailureCount_;
  }

  Serial.print(F("[MQTT] Connection failed (state "));
  Serial.print(mqttClient_.state());
  Serial.print(F(", attempt "));
  Serial.print(consecutiveFailureCount_);
  Serial.println(F("). Retry scheduled in 3 seconds."));
}

void MqttService::handleMessage(char* topic, std::uint8_t* payload,
                                unsigned int length) {
  if (topic == nullptr) {
    Serial.println(F("[MQTT] Unexpected inbound topic dropped."));
    return;
  }
  const String incomingTopic(topic);
  if (incomingTopic == MqttTopics::commandTopic(AppConfig::DEVICE_ID)) {
    handleCommand(payload, length);
  } else if (incomingTopic == MqttTopics::configTopic(AppConfig::DEVICE_ID)) {
    handleConfig(payload, length);
  } else {
    Serial.println(F("[MQTT] Unexpected inbound topic dropped."));
  }
}

void MqttService::handleCommand(std::uint8_t* payload, unsigned int length) {
  JsonDocument document;
  const DeserializationError jsonError =
      deserializeJson(document, payload, length);
  if (jsonError) {
    rejectCommand("INVALID_JSON");
    return;
  }

  if (!document.is<JsonObject>()) {
    rejectCommand("INVALID_PAYLOAD");
    return;
  }

  const JsonObjectConst root = document.as<JsonObjectConst>();
  const char* commandId = nullptr;
  if (root["commandId"].is<const char*>()) {
    const char* candidate = root["commandId"].as<const char*>();
    if (candidate != nullptr && candidate[0] != '\0' &&
        std::strlen(candidate) <= MAX_COMMAND_ID_LENGTH) {
      commandId = candidate;
    }
  }

  if (!root["schemaVersion"].is<int>() ||
      root["schemaVersion"].as<int>() != 1) {
    rejectCommand("INVALID_SCHEMA_VERSION", commandId);
    return;
  }
  if (commandId == nullptr) {
    rejectCommand("INVALID_COMMAND_ID");
    return;
  }
  if (!root["mode"].is<const char*>()) {
    rejectCommand("INVALID_MODE", commandId);
    return;
  }
  if (!root["target"].is<const char*>()) {
    rejectCommand("INVALID_TARGET", commandId);
    return;
  }
  const char* target = root["target"].as<const char*>();
  AutomationActuator actuator;
  if (std::strcmp(target, "FAN") == 0) actuator = AutomationActuator::Fan;
  else if (std::strcmp(target, "BUZZER") == 0) actuator = AutomationActuator::Buzzer;
  else {
    rejectCommand("INVALID_TARGET", commandId);
    return;
  }

  const char* mode = root["mode"].as<const char*>();
  if (std::strcmp(mode, "MANUAL") == 0) {
    if (!root["fanOn"].is<bool>()) {
      rejectCommand("INVALID_FAN_STATE", commandId);
      return;
    }
    if (!root["buzzerOn"].is<bool>()) {
      rejectCommand("INVALID_BUZZER_STATE", commandId);
      return;
    }
    automationService_.applyManualOutput(
        actuator, actuator == AutomationActuator::Fan
            ? root["fanOn"].as<bool>() : root["buzzerOn"].as<bool>());
  } else if (std::strcmp(mode, "RESUME_AUTOMATION") == 0) {
    automationService_.resumeAutomation(actuator);
  } else {
    rejectCommand("INVALID_MODE", commandId);
    return;
  }

  Serial.print(F("[MQTT] Manual command applied: "));
  Serial.println(commandId);

  // The ACK precedes status so consumers can correlate the state transition.
  publishCommandAck(commandId, true);
  publishStatus();
}

void MqttService::handleConfig(std::uint8_t* payload,
                               unsigned int length) {
  JsonDocument document;
  const DeserializationError jsonError =
      deserializeJson(document, payload, length);
  if (jsonError || !document.is<JsonObject>()) {
    publishConfigAck(0, false, "INVALID_JSON");
    return;
  }
  const JsonObjectConst root = document.as<JsonObjectConst>();
  const std::uint32_t version =
      root["configVersion"].is<std::uint32_t>()
          ? root["configVersion"].as<std::uint32_t>()
          : 0;
  char error[48];
  const bool applied =
      automationService_.applyConfiguration(root, error, sizeof(error));
  publishConfigAck(version, applied, applied ? nullptr : error);
  if (applied) {
    Serial.print(F("[Automation] Applied config version "));
    Serial.println(version);
    publishStatus();
  }
}

void MqttService::rejectCommand(const char* errorCode,
                                const char* commandId) {
  Serial.print(F("[MQTT] Command rejected: "));
  Serial.println(errorCode);
  if (commandId != nullptr) {
    publishCommandAck(commandId, false, errorCode);
  }
}

bool MqttService::publishCommandAck(const char* commandId, bool success,
                                    const char* errorCode) {
  if (!isConnected()) {
    return false;
  }

  JsonDocument document;
  document["schemaVersion"] = 1;
  document["deviceId"] = AppConfig::DEVICE_ID;
  document["commandId"] = commandId;
  document["success"] = success;
  if (success) {
    document["fanOn"] = actuatorService_.isFanOn();
    document["buzzerOn"] = actuatorService_.isBuzzerOn();
  } else {
    document["error"] = errorCode == nullptr ? "INVALID_PAYLOAD" : errorCode;
  }

  char payload[JSON_BUFFER_SIZE];
  if (!serializePayload(document, payload)) {
    return false;
  }

  const String topic = MqttTopics::commandAckTopic(AppConfig::DEVICE_ID);
  const bool published = mqttClient_.publish(topic.c_str(), payload, false);
  Serial.println(published ? F("[MQTT] Command ACK published.")
                           : F("[MQTT] Command ACK publish failed."));
  return published;
}

bool MqttService::publishConfigAck(std::uint32_t configVersion, bool success,
                                  const char* errorCode) {
  if (!isConnected()) {
    return false;
  }
  JsonDocument document;
  document["schemaVersion"] = 1;
  document["deviceId"] = AppConfig::DEVICE_ID;
  document["configVersion"] = configVersion;
  document["success"] = success;
  if (!success) {
    document["error"] =
        errorCode == nullptr ? "INVALID_CONFIG" : errorCode;
  }
  char payload[JSON_BUFFER_SIZE];
  if (!serializePayload(document, payload)) {
    return false;
  }
  const String topic =
      MqttTopics::configAckTopic(AppConfig::DEVICE_ID);
  const bool published = mqttClient_.publish(topic.c_str(), payload, false);
  Serial.println(published ? F("[MQTT] Config ACK published.")
                           : F("[MQTT] Config ACK publish failed."));
  return published;
}
