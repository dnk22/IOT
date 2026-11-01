#include "sensors/SensorService.h"

#include <Arduino.h>
#include <cmath>
#include <limits>

#include "AppConfig.h"
#include "Pins.h"
#include "perf/PerfMetrics.h"

SensorService::SensorService() : dht_(Pins::DHT22_DATA, DHT22) {
}

void SensorService::begin() {
  dht_.begin();
  pinMode(Pins::LDR_ANALOG, INPUT);
  analogReadResolution(12);
}

SensorReading SensorService::read() {
  SensorReading reading;
  reading.sampledAtMs = millis();

  const std::uint32_t dhtStartedAtUs = micros();
  const float temperatureC = dht_.readTemperature();
  const float humidityPct = dht_.readHumidity();
  const std::uint32_t dhtDurationUs = micros() - dhtStartedAtUs;

  if (!std::isnan(temperatureC) && !std::isnan(humidityPct)) {
    reading.temperatureC = temperatureC;
    reading.humidityPct = humidityPct;
    reading.dhtValid = true;
  } else {
    reading.temperatureC = std::numeric_limits<float>::quiet_NaN();
    reading.humidityPct = std::numeric_limits<float>::quiet_NaN();
  }

  const std::uint32_t ldrStartedAtUs = micros();
  reading.lightRaw = static_cast<std::uint16_t>(analogRead(Pins::LDR_ANALOG));
  const std::uint32_t ldrDurationUs = micros() - ldrStartedAtUs;
  PerfMetrics::setSensorParts(dhtDurationUs, ldrDurationUs);

  // Uncalibrated normalized ADC percentage; direction depends on the LDR module.
  const float adcRange = AppConfig::LDR_ADC_MAX - AppConfig::LDR_ADC_MIN;
  const float normalized =
      (reading.lightRaw - AppConfig::LDR_ADC_MIN) * 100.0F / adcRange;
  reading.lightPct = constrain(normalized, 0.0F, 100.0F);

  return reading;
}

