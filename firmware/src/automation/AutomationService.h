#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <cstdint>

#include "AppConfig.h"
#include "models/Models.h"

class ActuatorService;

enum class AutomationSensor : std::uint8_t {
  Temperature,
  Humidity,
  Light,
};

enum class AutomationOperator : std::uint8_t {
  Greater,
  GreaterOrEqual,
  Less,
  LessOrEqual,
};

enum class AutomationActuator : std::uint8_t {
  Fan,
  Buzzer,
};

struct AutomationRule {
  char id[65] = "";
  char name[81] = "";
  bool enabled = false;
  AutomationSensor sensor = AutomationSensor::Temperature;
  AutomationOperator comparison = AutomationOperator::GreaterOrEqual;
  float threshold = 0.0F;
  AutomationActuator actuator = AutomationActuator::Fan;
  bool actionOn = false;
  std::uint32_t createdSequence = 0;
};

class AutomationService {
 public:
  explicit AutomationService(ActuatorService& actuatorService);

  void begin();
  bool applyConfiguration(JsonObjectConst root, char* error,
                          std::size_t errorSize);
  bool evaluate(const SensorReading& reading, std::uint32_t nowMs);
  bool applyManualOutput(AutomationActuator actuator, bool desiredOn);
  bool resumeAutomation(AutomationActuator actuator);

  std::uint32_t configVersion() const;
  const char* fanSource() const;
  const char* buzzerSource() const;
  const char* fanActiveRuleId() const;
  const char* buzzerActiveRuleId() const;
  bool automationEnabled() const;
  bool fanManualOverride() const;
  bool buzzerManualOverride() const;
  std::uint8_t ruleCount() const;
  void appendRuleStates(JsonArray target) const;

 private:
  enum class RuntimeState : std::uint8_t {
    Disabled,
    Inactive,
    Active,
    Releasing,
  };

  struct RuleRuntime {
    RuntimeState state = RuntimeState::Inactive;
    std::uint32_t falseSinceMs = 0;
  };

  bool parseConfiguration(JsonObjectConst root, bool persist, char* error,
                          std::size_t errorSize);
  bool conditionMatches(const AutomationRule& rule,
                        const SensorReading& reading) const;
  void clearRuntime();
  bool resolveOutputs();
  static const char* runtimeStateName(RuntimeState state);
  static bool winsOver(const AutomationRule& candidate,
                       const AutomationRule* current);
  static void setError(char* target, std::size_t size, const char* value);

  ActuatorService& actuatorService_;
  AutomationRule rules_[AppConfig::AUTOMATION_MAX_RULES];
  RuleRuntime runtime_[AppConfig::AUTOMATION_MAX_RULES];
  std::uint8_t ruleCount_ = 0;
  std::uint32_t configVersion_ = 0;
  bool automationEnabled_ = false;
  bool fanManualOverride_ = false;
  bool buzzerManualOverride_ = false;
  bool fanManualDesired_ = false;
  bool buzzerManualDesired_ = false;
  bool hasReading_ = false;
  SensorReading lastReading_;
  String currentConfigJson_;
  const AutomationRule* fanWinner_ = nullptr;
  const AutomationRule* buzzerWinner_ = nullptr;
  const char* fanSource_ = "MANUAL_BASE";
  const char* buzzerSource_ = "MANUAL_BASE";
};
