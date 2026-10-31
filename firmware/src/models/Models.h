#pragma once

#include <cstdint>
#include <limits>

struct SensorReading {
  float temperatureC = std::numeric_limits<float>::quiet_NaN();
  float humidityPct = std::numeric_limits<float>::quiet_NaN();
  std::uint16_t lightRaw = 0;
  float lightPct = 0.0F;
  std::uint32_t sampledAtMs = 0;
  bool dhtValid = false;
};

