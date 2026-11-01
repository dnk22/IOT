#pragma once

#include <cstdint>

#ifndef ENABLE_EMBEDDED_PERF_TEST
#define ENABLE_EMBEDDED_PERF_TEST 0
#endif

namespace PerfMetrics {

#if ENABLE_EMBEDDED_PERF_TEST

void begin();
void setSensorParts(std::uint32_t dhtDurationUs,
                    std::uint32_t ldrDurationUs);
void recordSensor(std::uint32_t sampleAtMs,
                  std::uint32_t acquisitionDurationUs);
void recordAutomation(std::uint32_t durationUs, std::uint8_t ruleCount,
                      bool stateChanged);
void recordMqttPublish(const char* kind, std::uint32_t durationUs,
                       bool success);
void recordManualCommand(std::uint32_t durationUs, bool gpioChanged);
void recordGpioWrite(std::uint8_t pin, bool on);
void recordReleaseStart(std::uint8_t ruleIndex, std::uint32_t nowMs);
void recordReleaseComplete(std::uint8_t ruleIndex, std::uint32_t elapsedMs);
void recordReleaseCancelled(std::uint8_t ruleIndex, std::uint32_t elapsedMs);
void recordLoop(std::uint32_t durationUs);
void tick(std::uint32_t nowMs, bool wifiConnected, bool mqttConnected,
          std::uint8_t ruleCount, bool fanOn, bool buzzerOn);

#else

inline void begin() {}
inline void setSensorParts(std::uint32_t, std::uint32_t) {}
inline void recordSensor(std::uint32_t, std::uint32_t) {}
inline void recordAutomation(std::uint32_t, std::uint8_t, bool) {}
inline void recordMqttPublish(const char*, std::uint32_t, bool) {}
inline void recordManualCommand(std::uint32_t, bool) {}
inline void recordGpioWrite(std::uint8_t, bool) {}
inline void recordReleaseStart(std::uint8_t, std::uint32_t) {}
inline void recordReleaseComplete(std::uint8_t, std::uint32_t) {}
inline void recordReleaseCancelled(std::uint8_t, std::uint32_t) {}
inline void recordLoop(std::uint32_t) {}
inline void tick(std::uint32_t, bool, bool, std::uint8_t, bool, bool) {}

#endif

}  // namespace PerfMetrics
