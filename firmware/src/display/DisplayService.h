#pragma once

#include <Arduino.h>
#include <Adafruit_SSD1306.h>
#include <cstddef>
#include <cstdint>

#include "models/Models.h"

enum class DisplayState {
  Normal,
  WifiConnecting,
  MqttConnecting,
  CommandReceived,
  Error,
};

class DisplayService {
 public:
  DisplayService();

  bool begin();
  void tick(std::uint32_t nowMs, const SensorReading& reading,
            bool wifiConnected, bool mqttConnected,
            bool showMqttConnecting, bool fanOn, bool buzzerOn,
            const String& wifiSsid);

  void showNormal();
  void showWifiConnecting();
  void showMqttConnecting();
  void showCommand(const char* mode, bool fanOn, bool buzzerOn,
                   std::uint32_t durationMs = 2000);
  void showError(const char* title, const char* line1,
                 const char* line2 = nullptr, std::uint32_t durationMs = 0);

  bool isAvailable() const;

 private:
  static constexpr std::size_t TEXT_BUFFER_SIZE = 22;

  void setState(DisplayState state);
  DisplayState connectionState(bool wifiConnected, bool mqttConnected,
                               bool showMqttConnecting) const;
  bool isOverrideState() const;
  void render(const SensorReading& reading, bool wifiConnected,
              bool mqttConnected, bool fanOn, bool buzzerOn,
              const String& wifiSsid);
  void renderNormal(const SensorReading& reading, bool wifiConnected,
                    bool mqttConnected, bool fanOn, bool buzzerOn,
                    const String& wifiSsid);
  void renderWifiConnecting();
  void renderMqttConnecting(const String& wifiSsid);
  void renderCommand();
  void renderError();
  void printWifiLine(bool wifiConnected, const String& wifiSsid);
  void drawDivider();
  static void copyText(char* destination, const char* source);

  Adafruit_SSD1306 display_;
  DisplayState state_ = DisplayState::WifiConnecting;
  std::uint32_t stateStartedAtMs_ = 0;
  std::uint32_t stateDurationMs_ = 0;
  std::uint32_t lastRenderAtMs_ = 0;
  bool initializationAttempted_ = false;
  bool available_ = false;
  bool redrawRequired_ = true;

  char commandMode_[TEXT_BUFFER_SIZE] = "";
  bool commandFanOn_ = false;
  bool commandBuzzerOn_ = false;
  char errorTitle_[TEXT_BUFFER_SIZE] = "";
  char errorLine1_[TEXT_BUFFER_SIZE] = "";
  char errorLine2_[TEXT_BUFFER_SIZE] = "";
};
