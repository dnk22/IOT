#include "perf/PerfMetrics.h"

#if ENABLE_EMBEDDED_PERF_TEST

#include <Arduino.h>
#include <esp_system.h>

#ifndef FIRMWARE_GIT_SHA
#define FIRMWARE_GIT_SHA "unknown"
#endif

namespace PerfMetrics {
namespace {

constexpr std::size_t LOOP_BUFFER_SIZE = 64;
constexpr std::uint32_t LOOP_SAMPLE_INTERVAL_US = 100000;
constexpr std::uint32_t REPORT_INTERVAL_MS = 10000;

struct ReleaseEvent {
  const char* metric = nullptr;
  std::uint8_t ruleIndex = 0;
  std::uint32_t valueMs = 0;
};

struct MetricEvent {
  const char* testId = nullptr;
  const char* metric = nullptr;
  std::uint32_t value = 0;
  const char* unit = nullptr;
  std::uint32_t monotonicMs = 0;
  const char* condition = nullptr;
};

std::uint32_t runId = 0;
std::uint32_t sequence = 0;
std::uint32_t previousSampleAtMs = 0;
bool hasPreviousSample = false;
std::uint32_t sensorDhtDurationUs = 0;
std::uint32_t sensorLdrDurationUs = 0;
std::uint32_t lastReportAtMs = 0;
std::uint32_t lastLoopSampleAtUs = 0;
std::uint32_t loopDurationsUs[LOOP_BUFFER_SIZE]{};
std::size_t loopCount = 0;
std::size_t loopWriteIndex = 0;
ReleaseEvent releaseEvents[8]{};
std::size_t releaseEventCount = 0;
MetricEvent metricEvents[32]{};
std::size_t metricEventCount = 0;
bool lastWifiConnected = false;
bool lastMqttConnected = false;
bool connectivityKnown = false;

void printPrefix(const char* testId, const char* metric,
                 std::uint32_t monotonicMs) {
  Serial.print(F("[PERF] {\"runId\":"));
  Serial.print(runId);
  Serial.print(F(",\"firmwareGitSha\":\""));
  Serial.print(FIRMWARE_GIT_SHA);
  Serial.print(F("\",\"mode\":\"instrumented\",\"sequence\":"));
  Serial.print(++sequence);
  Serial.print(F(",\"uptimeMs\":"));
  Serial.print(monotonicMs);
  Serial.print(F(",\"testId\":\""));
  Serial.print(testId);
  Serial.print(F("\",\"metric\":\""));
  Serial.print(metric);
  Serial.print(F("\",\"value\":"));
}

void emitUnsigned(const char* testId, const char* metric,
                  std::uint32_t value, const char* unit,
                  std::uint32_t monotonicMs,
                  const char* condition = "stable_wifi_mqtt") {
  printPrefix(testId, metric, monotonicMs);
  Serial.print(value);
  Serial.print(F(",\"unit\":\""));
  Serial.print(unit);
  Serial.print(F("\",\"condition\":\""));
  Serial.print(condition);
  Serial.println(F("\"}"));
}

void queueReleaseEvent(const char* metric, std::uint8_t ruleIndex,
                       std::uint32_t valueMs) {
  if (releaseEventCount >= 8) return;
  ReleaseEvent& event = releaseEvents[releaseEventCount++];
  event.metric = metric;
  event.ruleIndex = ruleIndex;
  event.valueMs = valueMs;
}

void queueMetric(const char* testId, const char* metric,
                 std::uint32_t value, const char* unit,
                 std::uint32_t monotonicMs,
                 const char* condition = "stable_wifi_mqtt") {
  if (metricEventCount >= 32) return;
  MetricEvent& event = metricEvents[metricEventCount++];
  event.testId = testId;
  event.metric = metric;
  event.value = value;
  event.unit = unit;
  event.monotonicMs = monotonicMs;
  event.condition = condition;
}

void emitMemory(const char* condition, std::uint8_t ruleCount,
                bool fanOn, bool buzzerOn, std::uint32_t nowMs) {
  emitUnsigned("T08", "free_heap", ESP.getFreeHeap(), "bytes", nowMs,
               condition);
  emitUnsigned("T08", "min_free_heap", ESP.getMinFreeHeap(), "bytes", nowMs,
               condition);
  emitUnsigned("T08", "max_alloc_heap", ESP.getMaxAllocHeap(), "bytes", nowMs,
               condition);
  emitUnsigned("T08", "sketch_size", ESP.getSketchSize(), "bytes", nowMs,
               condition);
  emitUnsigned("T08", "active_rule_count", ruleCount, "count", nowMs,
               condition);
  emitUnsigned("T08", "fan_reported_on", fanOn ? 1U : 0U, "boolean", nowMs,
               condition);
  emitUnsigned("T08", "buzzer_reported_on", buzzerOn ? 1U : 0U, "boolean",
               nowMs, condition);
}

}  // namespace

void begin() {
  runId = esp_random();
  Serial.print(F("[PERF_META] {\"runId\":"));
  Serial.print(runId);
  Serial.print(F(",\"firmwareGitSha\":\""));
  Serial.print(FIRMWARE_GIT_SHA);
  Serial.print(F("\",\"mode\":\"instrumented\",\"bootFreeHeap\":"));
  Serial.print(ESP.getFreeHeap());
  Serial.print(F(",\"bootMinFreeHeap\":"));
  Serial.print(ESP.getMinFreeHeap());
  Serial.print(F(",\"bootMaxAllocHeap\":"));
  Serial.print(ESP.getMaxAllocHeap());
  Serial.print(F(",\"sketchSize\":"));
  Serial.print(ESP.getSketchSize());
  Serial.println(F("}"));
}

void setSensorParts(std::uint32_t dhtDurationUs,
                    std::uint32_t ldrDurationUs) {
  sensorDhtDurationUs = dhtDurationUs;
  sensorLdrDurationUs = ldrDurationUs;
}

void recordSensor(std::uint32_t sampleAtMs,
                  std::uint32_t acquisitionDurationUs) {
  if (hasPreviousSample) {
    queueMetric("T01", "sensor_interval", sampleAtMs - previousSampleAtMs,
                "ms", sampleAtMs);
  }
  previousSampleAtMs = sampleAtMs;
  hasPreviousSample = true;
  queueMetric("T02", "sensor_acquisition", acquisitionDurationUs, "us",
              sampleAtMs);
  queueMetric("T02", "dht_acquisition", sensorDhtDurationUs, "us",
              sampleAtMs);
  queueMetric("T02", "ldr_acquisition", sensorLdrDurationUs, "us",
              sampleAtMs);
}

void recordAutomation(std::uint32_t durationUs, std::uint8_t ruleCount,
                      bool stateChanged) {
  const std::uint32_t nowMs = millis();
  queueMetric("T03", "automation_evaluate", durationUs, "us", nowMs);
  queueMetric("T03", "automation_rule_count", ruleCount, "count", nowMs);
  queueMetric("T03", "automation_state_changed", stateChanged ? 1U : 0U,
              "boolean", nowMs);
}

void recordMqttPublish(const char* kind, std::uint32_t durationUs,
                       bool success) {
  const std::uint32_t nowMs = millis();
  queueMetric("T06", kind, durationUs, "us", nowMs);
  queueMetric("T06", success ? "mqtt_publish_success" : "mqtt_publish_failure",
              1, "count", nowMs);
}

void recordManualCommand(std::uint32_t durationUs, bool gpioChanged) {
  const std::uint32_t nowMs = millis();
  queueMetric("T04", "manual_command_to_gpio_return", durationUs, "us", nowMs,
              gpioChanged ? "GPIO_CHANGED" : "NO_CHANGE");
}

void recordGpioWrite(std::uint8_t pin, bool on) {
  queueMetric("F09", pin == 25 ? "fan_gpio_write" : "buzzer_gpio_write",
              on ? 1U : 0U, "boolean", millis());
}

void recordReleaseStart(std::uint8_t ruleIndex, std::uint32_t) {
  queueReleaseEvent("release_started", ruleIndex, 0);
}

void recordReleaseComplete(std::uint8_t ruleIndex, std::uint32_t elapsedMs) {
  queueReleaseEvent("release_completed", ruleIndex, elapsedMs);
}

void recordReleaseCancelled(std::uint8_t ruleIndex, std::uint32_t elapsedMs) {
  queueReleaseEvent("release_cancelled", ruleIndex, elapsedMs);
}

void recordLoop(std::uint32_t durationUs) {
  const std::uint32_t nowUs = micros();
  if (nowUs - lastLoopSampleAtUs < LOOP_SAMPLE_INTERVAL_US) return;
  lastLoopSampleAtUs = nowUs;
  loopDurationsUs[loopWriteIndex] = durationUs;
  loopWriteIndex = (loopWriteIndex + 1) % LOOP_BUFFER_SIZE;
  if (loopCount < LOOP_BUFFER_SIZE) ++loopCount;
}

void tick(std::uint32_t nowMs, bool wifiConnected, bool mqttConnected,
          std::uint8_t ruleCount, bool fanOn, bool buzzerOn) {
  if (!connectivityKnown || wifiConnected != lastWifiConnected ||
      mqttConnected != lastMqttConnected) {
    const char* condition = mqttConnected ? "mqtt_connected"
        : (wifiConnected ? "wifi_only" : "network_disconnected");
    emitMemory(condition, ruleCount, fanOn, buzzerOn, nowMs);
    lastWifiConnected = wifiConnected;
    lastMqttConnected = mqttConnected;
    connectivityKnown = true;
  }

  for (std::size_t index = 0; index < metricEventCount; ++index) {
    const MetricEvent& event = metricEvents[index];
    emitUnsigned(event.testId, event.metric, event.value, event.unit,
                 event.monotonicMs, event.condition);
  }
  metricEventCount = 0;

  for (std::size_t index = 0; index < releaseEventCount; ++index) {
    emitUnsigned("T05", releaseEvents[index].metric,
                 releaseEvents[index].valueMs, "ms", nowMs);
    emitUnsigned("T05", "release_rule_index", releaseEvents[index].ruleIndex,
                 "index", nowMs);
  }
  releaseEventCount = 0;

  if (nowMs - lastReportAtMs < REPORT_INTERVAL_MS) return;
  lastReportAtMs = nowMs;
  emitMemory(mqttConnected ? "mqtt_connected" :
                 (wifiConnected ? "wifi_only" : "network_disconnected"),
             ruleCount, fanOn, buzzerOn, nowMs);
  for (std::size_t index = 0; index < loopCount; ++index) {
    const std::size_t position =
        (loopWriteIndex + LOOP_BUFFER_SIZE - loopCount + index) %
        LOOP_BUFFER_SIZE;
    emitUnsigned("T07", "main_loop_cycle", loopDurationsUs[position], "us",
                 nowMs);
  }
  loopCount = 0;
}

}  // namespace PerfMetrics

#endif
