#include <ArduinoJson.h>

#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "Preferences.h"
#include "actuators/ActuatorService.h"
#include "automation/AutomationService.h"

namespace {

bool mockFanOn = false;
bool mockBuzzerOn = false;
std::uint32_t mockFanWrites = 0;
std::uint32_t mockBuzzerWrites = 0;

struct Rule {
  const char* id;
  bool enabled;
  const char* sensor;
  const char* comparison;
  float threshold;
  const char* unit;
  const char* actuator;
  const char* action;
  std::uint32_t sequence;
};

std::string configJson(std::uint32_t version, bool enabled,
                       const std::vector<Rule>& rules) {
  std::ostringstream output;
  output << "{\"schemaVersion\":1,\"deviceId\":\"esp32_01\",";
  output << "\"configVersion\":" << version << ",\"automationEnabled\":";
  output << (enabled ? "true" : "false") << ",\"rules\":[";
  for (std::size_t index = 0; index < rules.size(); ++index) {
    if (index != 0) output << ',';
    const Rule& rule = rules[index];
    output << "{\"id\":\"" << rule.id << "\",\"name\":\"Rule " << index;
    output << "\",\"enabled\":" << (rule.enabled ? "true" : "false");
    output << ",\"sensor\":\"" << rule.sensor << "\",\"operator\":\"";
    output << rule.comparison << "\",\"threshold\":" << rule.threshold;
    output << ",\"unit\":\"" << rule.unit << "\",\"actuator\":\"";
    output << rule.actuator << "\",\"action\":\"" << rule.action;
    output << "\",\"createdSequence\":" << rule.sequence << '}';
  }
  output << "]}";
  return output.str();
}

bool applyConfig(AutomationService& service, const std::string& json,
                 std::string* errorResult = nullptr) {
  JsonDocument document;
  const DeserializationError parseError = deserializeJson(document, json);
  assert(!parseError);
  char error[64]{};
  const bool accepted = service.applyConfiguration(
      document.as<JsonObjectConst>(), error, sizeof(error));
  if (errorResult != nullptr) *errorResult = error;
  return accepted;
}

SensorReading reading(float temperature, float humidity, std::uint16_t light,
                      bool valid = true) {
  SensorReading value;
  value.temperatureC = temperature;
  value.humidityPct = humidity;
  value.lightRaw = light;
  value.dhtValid = valid;
  return value;
}

void expect(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

}  // namespace

void ActuatorService::begin() {}
void ActuatorService::setFan(bool on) {
  mockFanOn = on;
  ++mockFanWrites;
}
void ActuatorService::setBuzzer(bool on) {
  mockBuzzerOn = on;
  ++mockBuzzerWrites;
}
void ActuatorService::setOutputs(bool fanOn, bool buzzerOn) {
  setFan(fanOn);
  setBuzzer(buzzerOn);
}
bool ActuatorService::isFanOn() const { return mockFanOn; }
bool ActuatorService::isBuzzerOn() const { return mockBuzzerOn; }
void ActuatorService::writeRelay(std::uint8_t, bool) {}

int main() {
  ActuatorService actuators;
  AutomationService service(actuators);

  const Rule oldFan{"old-fan", true, "TEMPERATURE", ">=", 25, "°C", "FAN", "ON", 1};
  const Rule newFan{"new-fan", true, "TEMPERATURE", ">=", 25, "°C", "FAN", "OFF", 2};
  const Rule buzzer{"buzzer", true, "HUMIDITY", ">=", 40, "%", "BUZZER", "ON", 3};
  expect(applyConfig(service, configJson(1, true, {oldFan, newFan, buzzer})),
         "valid config rejected");
  expect(hostPreferencesPutCount == 1, "valid config not persisted exactly once");

  const SensorReading high = reading(30, 50, 2000);
  service.evaluate(high, 1000);
  expect(!mockFanOn && mockBuzzerOn, "newer conflicting rule did not win");
  expect(std::strcmp(service.fanActiveRuleId(), "new-fan") == 0,
         "winner ID mismatch");
  const std::uint32_t writesAfterFirstEvaluation = mockFanWrites + mockBuzzerWrites;
  service.evaluate(high, 2000);
  expect(mockFanWrites + mockBuzzerWrites == writesAfterFirstEvaluation,
         "identical evaluation repeated GPIO write");

  service.applyManualOutput(AutomationActuator::Fan, true);
  expect(mockFanOn && service.fanManualOverride(), "fan override did not win");
  expect(mockBuzzerOn && !service.buzzerManualOverride(),
         "fan override incorrectly affected buzzer");
  service.resumeAutomation(AutomationActuator::Fan);
  expect(!mockFanOn && !service.fanManualOverride(),
         "resume fan did not restore automation winner");

  // Return the persistent manual base to OFF before testing claim release.
  service.applyManualOutput(AutomationActuator::Fan, false);
  service.resumeAutomation(AutomationActuator::Fan);

  const Rule releaseFan{"release-fan", true, "TEMPERATURE", ">=", 25, "°C", "FAN", "ON", 4};
  expect(applyConfig(service, configJson(2, true, {releaseFan})), "release config rejected");
  service.evaluate(high, 10000);
  expect(mockFanOn, "true condition did not activate immediately");
  service.evaluate(reading(20, 50, 2000), 12000);
  expect(mockFanOn, "claim released on first false observation");
  service.evaluate(reading(20, 50, 2000), 16000);
  expect(mockFanOn, "claim released before 5000 ms threshold");
  service.evaluate(high, 16500);
  expect(mockFanOn, "return true did not cancel release");
  service.evaluate(reading(NAN, NAN, 2000, false), 18000);
  expect(mockFanOn, "invalid DHT released claim immediately");
  service.evaluate(reading(NAN, NAN, 2000, false), 23000);
  expect(!mockFanOn, "invalid DHT did not release after 5000 ms");

  expect(applyConfig(service, configJson(3, true, {releaseFan})), "reactivation config rejected");
  service.evaluate(high, 24000);
  expect(mockFanOn, "reactivation failed");
  expect(applyConfig(service, configJson(4, false, {releaseFan})), "master-off config rejected");
  expect(!mockFanOn, "master off did not release immediately");
  Rule disabledFan = releaseFan;
  disabledFan.enabled = false;
  expect(applyConfig(service, configJson(5, true, {disabledFan})), "disabled config rejected");
  expect(!mockFanOn, "disabled rule claimed output");
  expect(applyConfig(service, configJson(6, true, {})), "delete-all config rejected");
  expect(service.ruleCount() == 0 && !mockFanOn, "deletion did not release output");

  std::string error;
  expect(!applyConfig(service, configJson(5, true, {}), &error) && error == "STALE_CONFIG_VERSION",
         "stale config accepted");
  const std::size_t writesBeforeIdempotent = hostPreferencesPutCount;
  expect(applyConfig(service, configJson(6, true, {}), &error) && error.empty(),
         "identical current config not idempotent");
  expect(hostPreferencesPutCount == writesBeforeIdempotent,
         "idempotent config wrote NVS");
  expect(!applyConfig(service, configJson(6, false, {}), &error) &&
             error == "CONFIG_VERSION_CONFLICT",
         "same-version conflict accepted");

  std::vector<Rule> sixteen;
  std::vector<std::string> ids;
  ids.reserve(17);
  sixteen.reserve(16);
  for (std::uint32_t index = 0; index < 17; ++index) {
    ids.push_back("capacity-" + std::to_string(index));
    if (index < 16) {
      sixteen.push_back({ids.back().c_str(), true, "LIGHT", ">=", 0,
                         "ADC", "FAN", "OFF", 100 + index});
    }
  }
  expect(applyConfig(service, configJson(7, true, sixteen)), "16 rules rejected");
  sixteen.push_back({ids[16].c_str(), true, "LIGHT", ">=", 0,
                     "ADC", "FAN", "OFF", 116});
  expect(!applyConfig(service, configJson(8, true, sixteen), &error) &&
             error == "TOO_MANY_RULES",
         "17th rule was not rejected");

  std::cout << "Automation production service host test: PASS\n";
  std::cout << "Cases: winner precedence, no-repeat GPIO, per-actuator override, "
               "resume, release/cancel/invalid-DHT, master-off, disable/delete, "
               "stale/idempotent/conflict, 16/17 capacity\n";
  return 0;
}
