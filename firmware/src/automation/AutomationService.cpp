#include "automation/AutomationService.h"

#include <Preferences.h>
#include <cmath>
#include <cstring>

#include "actuators/ActuatorService.h"

namespace {

constexpr char NVS_NAMESPACE[] = "automation";
constexpr char NVS_CONFIG_KEY[] = "config";

bool copyText(const char* source, char* target, std::size_t capacity) {
  if (source == nullptr || source[0] == '\0' ||
      std::strlen(source) >= capacity) {
    return false;
  }
  std::strncpy(target, source, capacity);
  target[capacity - 1] = '\0';
  return true;
}

bool parseSensor(const char* value, AutomationSensor& sensor) {
  if (value == nullptr) return false;
  if (std::strcmp(value, "TEMPERATURE") == 0) {
    sensor = AutomationSensor::Temperature;
    return true;
  }
  if (std::strcmp(value, "HUMIDITY") == 0) {
    sensor = AutomationSensor::Humidity;
    return true;
  }
  if (std::strcmp(value, "LIGHT") == 0) {
    sensor = AutomationSensor::Light;
    return true;
  }
  return false;
}

bool parseOperator(const char* value, AutomationOperator& comparison) {
  if (value == nullptr) return false;
  if (std::strcmp(value, ">") == 0) {
    comparison = AutomationOperator::Greater;
    return true;
  }
  if (std::strcmp(value, ">=") == 0) {
    comparison = AutomationOperator::GreaterOrEqual;
    return true;
  }
  if (std::strcmp(value, "<") == 0) {
    comparison = AutomationOperator::Less;
    return true;
  }
  if (std::strcmp(value, "<=") == 0) {
    comparison = AutomationOperator::LessOrEqual;
    return true;
  }
  return false;
}

bool parseActuator(const char* value, AutomationActuator& actuator) {
  if (value == nullptr) return false;
  if (std::strcmp(value, "FAN") == 0) {
    actuator = AutomationActuator::Fan;
    return true;
  }
  if (std::strcmp(value, "BUZZER") == 0) {
    actuator = AutomationActuator::Buzzer;
    return true;
  }
  return false;
}

bool thresholdValid(AutomationSensor sensor, float threshold) {
  if (!std::isfinite(threshold)) return false;
  if (sensor == AutomationSensor::Temperature) return threshold >= -40.0F && threshold <= 80.0F;
  if (sensor == AutomationSensor::Humidity) return threshold >= 0.0F && threshold <= 100.0F;
  return threshold >= 0.0F && threshold <= 4095.0F;
}

bool unitValid(AutomationSensor sensor, const char* unit) {
  if (unit == nullptr) return false;
  if (sensor == AutomationSensor::Temperature) return std::strcmp(unit, "°C") == 0;
  if (sensor == AutomationSensor::Humidity) return std::strcmp(unit, "%") == 0;
  return std::strcmp(unit, "ADC") == 0;
}

}  // namespace

AutomationService::AutomationService(ActuatorService& actuatorService)
    : actuatorService_(actuatorService) {
}

void AutomationService::begin() {
  Preferences preferences;
  if (!preferences.begin(NVS_NAMESPACE, true)) {
    Serial.println(F("[Automation] NVS open failed."));
    return;
  }
  const String serialized = preferences.getString(NVS_CONFIG_KEY, "");
  preferences.end();
  if (serialized.isEmpty()) {
    Serial.println(F("[Automation] No stored configuration."));
    return;
  }

  JsonDocument document;
  const DeserializationError error = deserializeJson(document, serialized);
  if (error || !document.is<JsonObject>()) {
    Serial.println(F("[Automation] Stored configuration is invalid."));
    return;
  }
  char message[48];
  if (!parseConfiguration(document.as<JsonObjectConst>(), false, message,
                          sizeof(message))) {
    Serial.print(F("[Automation] Stored config rejected: "));
    Serial.println(message);
    return;
  }
  Serial.print(F("[Automation] Restored config version "));
  Serial.println(configVersion_);
}

bool AutomationService::applyConfiguration(JsonObjectConst root, char* error,
                                           std::size_t errorSize) {
  return parseConfiguration(root, true, error, errorSize);
}

bool AutomationService::parseConfiguration(JsonObjectConst root, bool persist,
                                           char* error,
                                           std::size_t errorSize) {
  if (!root["schemaVersion"].is<int>() ||
      root["schemaVersion"].as<int>() != 1) {
    setError(error, errorSize, "INVALID_SCHEMA_VERSION");
    return false;
  }
  if (!root["deviceId"].is<const char*>() ||
      std::strcmp(root["deviceId"].as<const char*>(), AppConfig::DEVICE_ID) != 0) {
    setError(error, errorSize, "INVALID_DEVICE_ID");
    return false;
  }
  if (!root["configVersion"].is<std::uint32_t>() ||
      root["configVersion"].as<std::uint32_t>() < 1) {
    setError(error, errorSize, "INVALID_CONFIG_VERSION");
    return false;
  }
  const std::uint32_t candidateVersion =
      root["configVersion"].as<std::uint32_t>();
  if (candidateVersion < configVersion_) {
    setError(error, errorSize, "STALE_CONFIG_VERSION");
    return false;
  }
  if (!root["automationEnabled"].is<bool>() ||
      !root["rules"].is<JsonArrayConst>()) {
    setError(error, errorSize, "INVALID_CONFIG");
    return false;
  }
  const JsonArrayConst incomingRules = root["rules"].as<JsonArrayConst>();
  if (incomingRules.size() > AppConfig::AUTOMATION_MAX_RULES) {
    setError(error, errorSize, "TOO_MANY_RULES");
    return false;
  }

  AutomationRule parsed[AppConfig::AUTOMATION_MAX_RULES];
  std::uint8_t count = 0;
  for (JsonObjectConst item : incomingRules) {
    AutomationRule& rule = parsed[count];
    if (!copyText(item["id"].as<const char*>(), rule.id, sizeof(rule.id)) ||
        !copyText(item["name"].as<const char*>(), rule.name,
                  sizeof(rule.name)) ||
        !item["enabled"].is<bool>() ||
        !parseSensor(item["sensor"].as<const char*>(), rule.sensor) ||
        !parseOperator(item["operator"].as<const char*>(), rule.comparison) ||
        !item["threshold"].is<float>() ||
        !std::isfinite(item["threshold"].as<float>()) ||
        !parseActuator(item["actuator"].as<const char*>(), rule.actuator) ||
        !item["action"].is<const char*>() ||
        !item["createdSequence"].is<std::uint32_t>() ||
        item["createdSequence"].as<std::uint32_t>() < 1) {
      setError(error, errorSize, "INVALID_RULE");
      return false;
    }
    const char* action = item["action"].as<const char*>();
    if (std::strcmp(action, "ON") != 0 && std::strcmp(action, "OFF") != 0) {
      setError(error, errorSize, "INVALID_RULE_ACTION");
      return false;
    }
    rule.enabled = item["enabled"].as<bool>();
    rule.threshold = item["threshold"].as<float>();
    if (!thresholdValid(rule.sensor, rule.threshold) ||
        !unitValid(rule.sensor, item["unit"].as<const char*>())) {
      setError(error, errorSize, "INVALID_RULE_THRESHOLD");
      return false;
    }
    rule.actionOn = std::strcmp(action, "ON") == 0;
    rule.createdSequence = item["createdSequence"].as<std::uint32_t>();
    for (std::uint8_t previous = 0; previous < count; ++previous) {
      if (std::strcmp(parsed[previous].id, rule.id) == 0 ||
          parsed[previous].createdSequence == rule.createdSequence) {
        setError(error, errorSize, "DUPLICATE_RULE");
        return false;
      }
    }
    ++count;
  }

  String serialized;
  serializeJson(root, serialized);
  if (candidateVersion == configVersion_ && configVersion_ != 0) {
    if (serialized == currentConfigJson_) {
      setError(error, errorSize, "");
      return true;
    }
    setError(error, errorSize, "CONFIG_VERSION_CONFLICT");
    return false;
  }

  if (persist) {
    Preferences preferences;
    if (!preferences.begin(NVS_NAMESPACE, false)) {
      setError(error, errorSize, "NVS_OPEN_FAILED");
      return false;
    }
    const std::size_t written =
        preferences.putString(NVS_CONFIG_KEY, serialized);
    preferences.end();
    if (written == 0) {
      setError(error, errorSize, "NVS_WRITE_FAILED");
      return false;
    }
  }

  ruleCount_ = count;
  for (std::uint8_t index = 0; index < count; ++index) {
    rules_[index] = parsed[index];
  }
  configVersion_ = candidateVersion;
  automationEnabled_ = root["automationEnabled"].as<bool>();
  currentConfigJson_ = serialized;
  clearRuntime();
  if (hasReading_) {
    evaluate(lastReading_, millis());
  } else {
    resolveOutputs();
  }
  setError(error, errorSize, "");
  return true;
}

bool AutomationService::evaluate(const SensorReading& reading,
                                 std::uint32_t nowMs) {
  lastReading_ = reading;
  hasReading_ = true;
  bool runtimeChanged = false;
  for (std::uint8_t index = 0; index < ruleCount_; ++index) {
    const AutomationRule& rule = rules_[index];
    RuleRuntime& state = runtime_[index];
    if (!automationEnabled_ || !rule.enabled) {
      const RuntimeState next = RuntimeState::Disabled;
      runtimeChanged = runtimeChanged || state.state != next;
      state.state = next;
      state.falseSinceMs = 0;
      continue;
    }
    if (conditionMatches(rule, reading)) {
      runtimeChanged = runtimeChanged || state.state != RuntimeState::Active;
      state.state = RuntimeState::Active;
      state.falseSinceMs = 0;
      continue;
    }
    if (state.state == RuntimeState::Inactive || state.state == RuntimeState::Disabled) {
      runtimeChanged = runtimeChanged || state.state != RuntimeState::Inactive;
      state.state = RuntimeState::Inactive;
      state.falseSinceMs = 0;
      continue;
    }
    if (state.state == RuntimeState::Active) {
      state.state = RuntimeState::Releasing;
      state.falseSinceMs = nowMs;
      runtimeChanged = true;
    } else if (nowMs - state.falseSinceMs >=
               AppConfig::AUTOMATION_RELEASE_DELAY_MS) {
      state.state = RuntimeState::Inactive;
      state.falseSinceMs = 0;
      runtimeChanged = true;
    }
  }
  return resolveOutputs() || runtimeChanged;
}

bool AutomationService::applyManualOutput(AutomationActuator actuator,
                                          bool desiredOn) {
  if (actuator == AutomationActuator::Fan) {
    fanManualDesired_ = desiredOn;
    fanManualOverride_ = true;
    return resolveOutputs();
  }

  buzzerManualDesired_ = desiredOn;
  buzzerManualOverride_ = true;
  return resolveOutputs();
}

bool AutomationService::resumeAutomation(AutomationActuator actuator) {
  if (actuator == AutomationActuator::Fan) {
    fanManualOverride_ = false;
  } else {
    buzzerManualOverride_ = false;
  }
  return resolveOutputs();
}

bool AutomationService::conditionMatches(const AutomationRule& rule,
                                         const SensorReading& reading) const {
  float value = 0.0F;
  if (rule.sensor == AutomationSensor::Temperature) {
    if (!reading.dhtValid || !std::isfinite(reading.temperatureC)) return false;
    value = reading.temperatureC;
  } else if (rule.sensor == AutomationSensor::Humidity) {
    if (!reading.dhtValid || !std::isfinite(reading.humidityPct)) return false;
    value = reading.humidityPct;
  } else {
    value = static_cast<float>(reading.lightRaw);
  }

  switch (rule.comparison) {
    case AutomationOperator::Greater:
      return value > rule.threshold;
    case AutomationOperator::GreaterOrEqual:
      return value >= rule.threshold;
    case AutomationOperator::Less:
      return value < rule.threshold;
    case AutomationOperator::LessOrEqual:
      return value <= rule.threshold;
  }
  return false;
}

void AutomationService::clearRuntime() {
  for (std::uint8_t index = 0; index < AppConfig::AUTOMATION_MAX_RULES;
       ++index) {
    runtime_[index] = RuleRuntime{};
    if (index < ruleCount_ && (!automationEnabled_ || !rules_[index].enabled)) {
      runtime_[index].state = RuntimeState::Disabled;
    }
  }
  fanWinner_ = nullptr;
  buzzerWinner_ = nullptr;
}

bool AutomationService::resolveOutputs() {
  const AutomationRule* nextFanWinner = nullptr;
  const AutomationRule* nextBuzzerWinner = nullptr;
  if (automationEnabled_) {
    for (std::uint8_t index = 0; index < ruleCount_; ++index) {
      if (runtime_[index].state != RuntimeState::Active &&
          runtime_[index].state != RuntimeState::Releasing) continue;
      const AutomationRule& candidate = rules_[index];
      if (candidate.actuator == AutomationActuator::Fan &&
          winsOver(candidate, nextFanWinner)) {
        nextFanWinner = &candidate;
      }
      if (candidate.actuator == AutomationActuator::Buzzer &&
          winsOver(candidate, nextBuzzerWinner)) {
        nextBuzzerWinner = &candidate;
      }
    }
  }
  fanWinner_ = nextFanWinner;
  buzzerWinner_ = nextBuzzerWinner;

  bool changed = false;
  const bool fanDesired = fanManualOverride_
      ? fanManualDesired_
      : (fanWinner_ == nullptr ? fanManualDesired_ : fanWinner_->actionOn);
  fanSource_ = fanManualOverride_ ? "MANUAL_OVERRIDE"
      : (fanWinner_ == nullptr ? "MANUAL_BASE" : "AUTOMATION");
  if (actuatorService_.isFanOn() != fanDesired) {
    actuatorService_.setFan(fanDesired);
    changed = true;
  }
  const bool buzzerDesired = buzzerManualOverride_
      ? buzzerManualDesired_
      : (buzzerWinner_ == nullptr ? buzzerManualDesired_ : buzzerWinner_->actionOn);
  buzzerSource_ = buzzerManualOverride_ ? "MANUAL_OVERRIDE"
      : (buzzerWinner_ == nullptr ? "MANUAL_BASE" : "AUTOMATION");
  if (actuatorService_.isBuzzerOn() != buzzerDesired) {
    actuatorService_.setBuzzer(buzzerDesired);
    changed = true;
  }
  return changed;
}

bool AutomationService::winsOver(const AutomationRule& candidate,
                                 const AutomationRule* current) {
  if (current == nullptr) return true;
  if (candidate.createdSequence != current->createdSequence) {
    return candidate.createdSequence > current->createdSequence;
  }
  return std::strcmp(candidate.id, current->id) > 0;
}

std::uint32_t AutomationService::configVersion() const {
  return configVersion_;
}

const char* AutomationService::fanSource() const {
  return fanSource_;
}

const char* AutomationService::buzzerSource() const {
  return buzzerSource_;
}

const char* AutomationService::fanActiveRuleId() const {
  return std::strcmp(fanSource_, "AUTOMATION") == 0 && fanWinner_ != nullptr
      ? fanWinner_->id : nullptr;
}

const char* AutomationService::buzzerActiveRuleId() const {
  return std::strcmp(buzzerSource_, "AUTOMATION") == 0 && buzzerWinner_ != nullptr
      ? buzzerWinner_->id : nullptr;
}

bool AutomationService::automationEnabled() const { return automationEnabled_; }
bool AutomationService::fanManualOverride() const { return fanManualOverride_; }
bool AutomationService::buzzerManualOverride() const { return buzzerManualOverride_; }

const char* AutomationService::runtimeStateName(RuntimeState state) {
  switch (state) {
    case RuntimeState::Disabled: return "DISABLED";
    case RuntimeState::Inactive: return "INACTIVE";
    case RuntimeState::Active: return "ACTIVE";
    case RuntimeState::Releasing: return "RELEASING";
  }
  return "INACTIVE";
}

void AutomationService::appendRuleStates(JsonArray target) const {
  for (std::uint8_t index = 0; index < ruleCount_; ++index) {
    JsonObject item = target.add<JsonObject>();
    item["id"] = rules_[index].id;
    item["state"] = runtimeStateName(runtime_[index].state);
  }
}

void AutomationService::setError(char* target, std::size_t size,
                                 const char* value) {
  if (target == nullptr || size == 0) return;
  std::strncpy(target, value, size);
  target[size - 1] = '\0';
}
