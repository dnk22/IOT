#include "actuators/ActuatorService.h"

#include <Arduino.h>

#include "AppConfig.h"
#include "Pins.h"
#include "perf/PerfMetrics.h"

namespace {

std::uint8_t relayLevel(bool on) {
  if (AppConfig::RELAY_ACTIVE_LOW) {
    return on ? LOW : HIGH;
  }
  return on ? HIGH : LOW;
}

}  // namespace

void ActuatorService::begin() {
  if (initialized_) {
    return;
  }

  // Preload OFF before OUTPUT mode to reduce relay glitches during boot.
  digitalWrite(Pins::FAN_RELAY_PIN, relayLevel(false));
  digitalWrite(Pins::BUZZER_RELAY_PIN, relayLevel(false));
  pinMode(Pins::FAN_RELAY_PIN, OUTPUT);
  pinMode(Pins::BUZZER_RELAY_PIN, OUTPUT);

  fanOn_ = false;
  buzzerOn_ = false;
  initialized_ = true;
  Serial.println(F("[Actuator] Fan OFF, buzzer OFF (safe boot state)."));
}

void ActuatorService::setFan(bool on) {
  if (initialized_ && fanOn_ == on) {
    return;
  }
  writeRelay(Pins::FAN_RELAY_PIN, on);
  fanOn_ = on;
}

void ActuatorService::setBuzzer(bool on) {
  if (initialized_ && buzzerOn_ == on) {
    return;
  }
  writeRelay(Pins::BUZZER_RELAY_PIN, on);
  buzzerOn_ = on;
}

void ActuatorService::setOutputs(bool fanOn, bool buzzerOn) {
  setFan(fanOn);
  setBuzzer(buzzerOn);
}

bool ActuatorService::isFanOn() const {
  return fanOn_;
}

bool ActuatorService::isBuzzerOn() const {
  return buzzerOn_;
}

void ActuatorService::writeRelay(std::uint8_t pin, bool on) {
  digitalWrite(pin, relayLevel(on));
  PerfMetrics::recordGpioWrite(pin, on);
}
