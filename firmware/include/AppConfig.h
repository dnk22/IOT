#pragma once

#include <cstdint>

namespace AppConfig {

constexpr char DEVICE_ID[] = "esp32_01";
constexpr char FIRMWARE_VERSION[] = "0.5.0";
constexpr std::uint32_t SERIAL_BAUD_RATE = 115200;

constexpr std::uint32_t SENSOR_SAMPLE_INTERVAL_MS = 2000;
constexpr std::uint32_t MQTT_STATUS_PUBLISH_INTERVAL_MS = 10000;
constexpr std::uint32_t WIFI_RECONNECT_INTERVAL_MS = 5000;
constexpr std::uint32_t MQTT_RECONNECT_INTERVAL_MS = 3000;
constexpr std::uint32_t MQTT_CONNECTING_DISPLAY_TIMEOUT_MS = 10000;
constexpr std::uint32_t MQTT_ERROR_DISPLAY_DURATION_MS = 3000;
constexpr std::uint8_t MQTT_INITIAL_MAX_FAILURES = 3;
constexpr std::uint16_t MQTT_SOCKET_TIMEOUT_SECONDS = 2;
constexpr std::uint16_t MQTT_TLS_HANDSHAKE_TIMEOUT_SECONDS = 3;
constexpr std::uint16_t MQTT_PACKET_BUFFER_SIZE = 8192;
constexpr std::uint8_t AUTOMATION_MAX_RULES = 16;
constexpr std::uint32_t AUTOMATION_RELEASE_DELAY_MS = 5000;
constexpr std::uint32_t DISPLAY_REFRESH_INTERVAL_MS = 250;

constexpr std::uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr std::uint8_t OLED_WIDTH = 128;
constexpr std::uint8_t OLED_HEIGHT = 64;

constexpr std::uint16_t LDR_ADC_MIN = 0;
constexpr std::uint16_t LDR_ADC_MAX = 4095;
constexpr bool RELAY_ACTIVE_LOW = true;

constexpr bool ENABLE_OLED = true;
constexpr bool ENABLE_ACTUATORS = true;
constexpr bool ENABLE_MQTT_CONTROL = true;

}  // namespace AppConfig
