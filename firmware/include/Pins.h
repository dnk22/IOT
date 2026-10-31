#pragma once

#include <cstdint>

namespace Pins {

// DHT22 temperature and humidity sensor data pin.
constexpr std::uint8_t DHT22_DATA = 18;

// LDR analog output. GPIO34 is input-only and is intentionally used for ADC input.
constexpr std::uint8_t LDR_ANALOG = 34;

// OLED I2C data and clock pins.
constexpr std::uint8_t OLED_SDA = 21;
constexpr std::uint8_t OLED_SCL = 22;

// Relay module channels used for manual fan and buzzer control.
constexpr std::uint8_t FAN_RELAY_PIN = 25;
constexpr std::uint8_t BUZZER_RELAY_PIN = 26;

}  // namespace Pins
