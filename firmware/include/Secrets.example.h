#pragma once

#include <cstdint>

namespace Secrets {

constexpr char WIFI_SSID[] = "YOUR_WIFI_SSID";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";

constexpr char MQTT_HOST[] = "YOUR_HIVEMQ_CLOUD_HOST";
constexpr std::uint16_t MQTT_PORT = 8883;
constexpr char MQTT_USERNAME[] = "YOUR_MQTT_USERNAME";
constexpr char MQTT_PASSWORD[] = "YOUR_MQTT_PASSWORD";
constexpr bool MQTT_USE_TLS = true;

// Paste the broker's trusted PEM CA certificate here before connecting.
constexpr char MQTT_CA_CERT[] = "";

}  // namespace Secrets
