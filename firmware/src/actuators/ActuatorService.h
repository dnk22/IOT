#pragma once

#include <cstdint>

class ActuatorService {
 public:
  void begin();
  void setFan(bool on);
  void setBuzzer(bool on);
  void setOutputs(bool fanOn, bool buzzerOn);

  bool isFanOn() const;
  bool isBuzzerOn() const;

 private:
  static void writeRelay(std::uint8_t pin, bool on);

  bool initialized_ = false;
  bool fanOn_ = false;
  bool buzzerOn_ = false;
};
