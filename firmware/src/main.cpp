#include <Arduino.h>

#include "AppConfig.h"
#include "actuators/ActuatorService.h"
#include "automation/AutomationService.h"
#include "display/DisplayService.h"
#include "models/Models.h"
#include "mqtt/MqttService.h"
#include "network/WifiService.h"
#include "sensors/SensorService.h"

namespace {

SensorService sensorService;
WifiService wifiService;
ActuatorService actuatorService;
AutomationService automationService(actuatorService);
MqttService mqttService(actuatorService, automationService, wifiService);
DisplayService displayService;
SensorReading latestReading;

std::uint32_t lastSampleAtMs = 0;
std::uint32_t lastStatusPublishAtMs = 0;
bool mqttStartupResolved = false;
bool mqttStartupWindowStarted = false;
std::uint32_t mqttStartupStartedAtMs = 0;

void updateMqttDisplayPolicy(std::uint32_t nowMs, bool wifiConnected,
                             bool mqttConnected) {
  if (mqttConnected) {
    mqttStartupResolved = true;
    mqttStartupWindowStarted = false;
    return;
  }

  if (!wifiConnected || mqttStartupResolved) {
    mqttStartupWindowStarted = false;
    return;
  }

  if (!mqttStartupWindowStarted) {
    mqttStartupWindowStarted = true;
    mqttStartupStartedAtMs = nowMs;
  }

  const bool tooManyFailures =
      mqttService.consecutiveFailureCount() >=
      AppConfig::MQTT_INITIAL_MAX_FAILURES;
  const bool timedOut =
      nowMs - mqttStartupStartedAtMs >=
      AppConfig::MQTT_CONNECTING_DISPLAY_TIMEOUT_MS;
  if (!tooManyFailures && !timedOut) {
    return;
  }

  mqttStartupResolved = true;
  mqttStartupWindowStarted = false;
  if (AppConfig::ENABLE_OLED) {
    displayService.showError(
        "MQTT ERROR",
        tooManyFailures ? "3 attempts failed" : "Connect timeout 10s",
        "Retry every 3s", AppConfig::MQTT_ERROR_DISPLAY_DURATION_MS);
  }
  Serial.println(F("[MQTT] Startup wait ended; sensor screen remains active."));
}

void printReading(const SensorReading& reading) {
  Serial.println(F("[Sensor]"));
  Serial.print(F("Sampled at  : "));
  Serial.print(reading.sampledAtMs);
  Serial.println(F(" ms"));

  if (reading.dhtValid) {
    Serial.print(F("Temperature : "));
    Serial.print(reading.temperatureC, 2);
    Serial.println(F(" C"));
    Serial.print(F("Humidity    : "));
    Serial.print(reading.humidityPct, 2);
    Serial.println(F(" %"));
  } else {
    Serial.println(F("Temperature : INVALID"));
    Serial.println(F("Humidity    : INVALID"));
  }

  Serial.print(F("Light raw   : "));
  Serial.println(reading.lightRaw);
  Serial.print(F("Light pct   : "));
  Serial.print(reading.lightPct, 2);
  Serial.println(F(" %"));
  Serial.print(F("DHT status  : "));
  Serial.println(reading.dhtValid ? F("OK") : F("ERROR"));
  Serial.println();
}

}  // namespace

void setup() {
  Serial.begin(AppConfig::SERIAL_BAUD_RATE);
  if (AppConfig::ENABLE_ACTUATORS) {
    actuatorService.begin();
  }
  automationService.begin();
  sensorService.begin();
  if (AppConfig::ENABLE_OLED) {
    displayService.begin();
  }
  wifiService.begin();
  mqttService.begin();

  Serial.println();
  Serial.println(F("IoT Smart Room - BTL Phase 2"));
  Serial.println(F("Local sensor sampling and MQTT telemetry started"));
}

void loop() {
  wifiService.loop();
  const bool wifiConnected = wifiService.isConnected();
  updateMqttDisplayPolicy(millis(), wifiConnected,
                          mqttService.isConnected());
  mqttService.loop(wifiConnected);
  const bool mqttConnected = mqttService.isConnected();

  const std::uint32_t nowMs = millis();
  updateMqttDisplayPolicy(nowMs, wifiConnected, mqttConnected);

  if (nowMs - lastSampleAtMs >= AppConfig::SENSOR_SAMPLE_INTERVAL_MS) {
    lastSampleAtMs = nowMs;
    latestReading = sensorService.read();
    printReading(latestReading);
    if (mqttConnected) {
      mqttService.publishTelemetry(latestReading);
    }
    if (automationService.evaluate(latestReading, nowMs) &&
        mqttConnected) {
      mqttService.publishStatus();
      lastStatusPublishAtMs = nowMs;
    }
  }

  if (AppConfig::ENABLE_OLED) {
    displayService.tick(nowMs, latestReading, wifiConnected, mqttConnected,
                        !mqttStartupResolved, actuatorService.isFanOn(),
                        actuatorService.isBuzzerOn(), wifiService.getSsid());
  }

  if (mqttConnected &&
      nowMs - lastStatusPublishAtMs >=
      AppConfig::MQTT_STATUS_PUBLISH_INTERVAL_MS) {
    lastStatusPublishAtMs = nowMs;
    mqttService.publishStatus();
  }
}
