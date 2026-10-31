#include "display/DisplayService.h"

#include <Arduino.h>
#include <Wire.h>
#include <cstring>

#include "AppConfig.h"
#include "Pins.h"

namespace {

constexpr std::int16_t DIVIDER_Y = 10;
constexpr std::int16_t FIRST_CONTENT_Y = 16;
constexpr std::int16_t ROW_HEIGHT = 12;
constexpr std::int16_t DASHBOARD_MQTT_Y = 9;
constexpr std::int16_t DASHBOARD_ACTUATOR_Y = 18;
constexpr std::int16_t DASHBOARD_DIVIDER_Y = 27;
constexpr std::int16_t DASHBOARD_TEMPERATURE_Y = 30;
constexpr std::int16_t DASHBOARD_HUMIDITY_Y = 41;
constexpr std::int16_t DASHBOARD_LIGHT_Y = 52;
constexpr std::size_t OLED_SSID_MAX_CHARS = 16;
constexpr std::size_t OLED_SSID_PREFIX_CHARS = 13;
constexpr std::uint32_t DEFAULT_COMMAND_DURATION_MS = 2000;

}  // namespace

DisplayService::DisplayService()
    : display_(AppConfig::OLED_WIDTH, AppConfig::OLED_HEIGHT, &Wire, -1) {
}

bool DisplayService::begin() {
  if (initializationAttempted_) {
    return available_;
  }
  initializationAttempted_ = true;

  Wire.begin(Pins::OLED_SDA, Pins::OLED_SCL);
  if (!display_.begin(SSD1306_SWITCHCAPVCC, AppConfig::OLED_I2C_ADDRESS)) {
    Serial.println(F("[Display] OLED initialization failed."));
    return false;
  }

  display_.clearDisplay();
  display_.setTextColor(SSD1306_WHITE);
  display_.setTextSize(1);
  display_.setTextWrap(false);
  display_.display();

  available_ = true;
  redrawRequired_ = true;
  Serial.println(F("[Display] OLED initialized."));
  return true;
}

void DisplayService::tick(std::uint32_t nowMs,
                          const SensorReading& reading,
                          bool wifiConnected, bool mqttConnected,
                          bool showMqttConnecting, bool fanOn,
                          bool buzzerOn, const String& wifiSsid) {
  if (!available_) {
    return;
  }

  if (isOverrideState()) {
    if (stateDurationMs_ > 0 &&
        nowMs - stateStartedAtMs_ >= stateDurationMs_) {
      setState(connectionState(wifiConnected, mqttConnected,
                               showMqttConnecting));
      stateDurationMs_ = 0;
    }
  } else {
    setState(connectionState(wifiConnected, mqttConnected,
                             showMqttConnecting));
  }

  if (!redrawRequired_ &&
      nowMs - lastRenderAtMs_ < AppConfig::DISPLAY_REFRESH_INTERVAL_MS) {
    return;
  }

  render(reading, wifiConnected, mqttConnected, fanOn, buzzerOn, wifiSsid);
  lastRenderAtMs_ = nowMs;
  redrawRequired_ = false;
}

void DisplayService::showNormal() {
  stateDurationMs_ = 0;
  setState(DisplayState::Normal);
}

void DisplayService::showWifiConnecting() {
  stateDurationMs_ = 0;
  setState(DisplayState::WifiConnecting);
}

void DisplayService::showMqttConnecting() {
  stateDurationMs_ = 0;
  setState(DisplayState::MqttConnecting);
}

void DisplayService::showCommand(const char* mode, bool fanOn, bool buzzerOn,
                                 std::uint32_t durationMs) {
  copyText(commandMode_, mode);
  commandFanOn_ = fanOn;
  commandBuzzerOn_ = buzzerOn;
  stateStartedAtMs_ = millis();
  stateDurationMs_ =
      durationMs == 0 ? DEFAULT_COMMAND_DURATION_MS : durationMs;
  setState(DisplayState::CommandReceived);
}

void DisplayService::showError(const char* title, const char* line1,
                               const char* line2,
                               std::uint32_t durationMs) {
  copyText(errorTitle_, title);
  copyText(errorLine1_, line1);
  copyText(errorLine2_, line2);
  stateStartedAtMs_ = millis();
  stateDurationMs_ = durationMs;
  setState(DisplayState::Error);
}

bool DisplayService::isAvailable() const {
  return available_;
}

void DisplayService::setState(DisplayState state) {
  if (state_ != state) {
    state_ = state;
    redrawRequired_ = true;
  }
}

DisplayState DisplayService::connectionState(bool wifiConnected,
                                             bool mqttConnected,
                                             bool showMqttConnecting) const {
  if (!wifiConnected) {
    return DisplayState::WifiConnecting;
  }
  return mqttConnected || !showMqttConnecting
             ? DisplayState::Normal
             : DisplayState::MqttConnecting;
}

bool DisplayService::isOverrideState() const {
  return state_ == DisplayState::CommandReceived ||
         state_ == DisplayState::Error;
}

void DisplayService::render(const SensorReading& reading, bool wifiConnected,
                            bool mqttConnected, bool fanOn, bool buzzerOn,
                            const String& wifiSsid) {
  display_.clearDisplay();
  display_.setTextColor(SSD1306_WHITE);
  display_.setTextSize(1);

  switch (state_) {
    case DisplayState::Normal:
      renderNormal(reading, wifiConnected, mqttConnected, fanOn, buzzerOn,
                   wifiSsid);
      break;
    case DisplayState::WifiConnecting:
      renderWifiConnecting();
      break;
    case DisplayState::MqttConnecting:
      renderMqttConnecting(wifiSsid);
      break;
    case DisplayState::CommandReceived:
      renderCommand();
      break;
    case DisplayState::Error:
      renderError();
      break;
  }

  display_.display();
}

void DisplayService::renderNormal(const SensorReading& reading,
                                  bool wifiConnected, bool mqttConnected,
                                  bool fanOn, bool buzzerOn,
                                  const String& wifiSsid) {
  display_.setCursor(0, 0);
  printWifiLine(wifiConnected, wifiSsid);

  display_.setCursor(0, DASHBOARD_MQTT_Y);
  display_.print(F("MQTT:"));
  display_.println(mqttConnected ? F("OK") : F("--"));

  display_.setCursor(0, DASHBOARD_ACTUATOR_Y);
  display_.print(F("Fan:"));
  display_.print(fanOn ? F("ON") : F("OFF"));
  display_.print(F(" Buzzer:"));
  display_.println(buzzerOn ? F("ON") : F("OFF"));

  display_.drawLine(0, DASHBOARD_DIVIDER_Y, AppConfig::OLED_WIDTH - 1,
                    DASHBOARD_DIVIDER_Y, SSD1306_WHITE);

  display_.setCursor(0, DASHBOARD_TEMPERATURE_Y);
  if (reading.dhtValid) {
    display_.print(F("Temperature:"));
    display_.print(reading.temperatureC, 1);
    display_.println(F(" C"));

    display_.setCursor(0, DASHBOARD_HUMIDITY_Y);
    display_.print(F("Humidity:"));
    display_.print(reading.humidityPct, 1);
    display_.println(F(" %"));
  } else {
    display_.println(F("Temperature:ERR"));
    display_.setCursor(0, DASHBOARD_HUMIDITY_Y);
    display_.println(F("Humidity:ERR"));
  }

  display_.setCursor(0, DASHBOARD_LIGHT_Y);
  display_.print(F("Light:"));
  display_.println(reading.lightRaw);
}

void DisplayService::renderWifiConnecting() {
  display_.setCursor(0, 0);
  display_.println(F("SMART ROOM"));
  drawDivider();
  display_.setCursor(0, FIRST_CONTENT_Y);
  display_.println(F("Connecting WiFi"));
  display_.setCursor(0, FIRST_CONTENT_Y + ROW_HEIGHT);
  display_.println(F("Please wait..."));
}

void DisplayService::renderMqttConnecting(const String& wifiSsid) {
  display_.setCursor(0, 0);
  printWifiLine(true, wifiSsid);
  display_.setCursor(0, FIRST_CONTENT_Y);
  display_.println(F("Connecting MQTT"));
  display_.setCursor(0, FIRST_CONTENT_Y + ROW_HEIGHT);
  display_.println(F("Please wait..."));
}

void DisplayService::renderCommand() {
  display_.setCursor(0, 0);
  display_.println(F("COMMAND RECEIVED"));
  drawDivider();
  display_.setCursor(0, FIRST_CONTENT_Y);
  display_.print(F("Mode : "));
  display_.println(commandMode_);
  display_.setCursor(0, FIRST_CONTENT_Y + ROW_HEIGHT);
  display_.print(F("Fan: "));
  display_.println(commandFanOn_ ? F("ON") : F("OFF"));
  display_.setCursor(0, FIRST_CONTENT_Y + 2 * ROW_HEIGHT);
  display_.print(F("Buzzer: "));
  display_.println(commandBuzzerOn_ ? F("ON") : F("OFF"));
}

void DisplayService::renderError() {
  display_.setCursor(0, 0);
  display_.println(errorTitle_);
  drawDivider();
  display_.setCursor(0, FIRST_CONTENT_Y);
  display_.println(errorLine1_);
  if (errorLine2_[0] != '\0') {
    display_.setCursor(0, FIRST_CONTENT_Y + ROW_HEIGHT);
    display_.println(errorLine2_);
  }
}

void DisplayService::printWifiLine(bool wifiConnected,
                                   const String& wifiSsid) {
  display_.print(F("WiFi:"));
  if (!wifiConnected) {
    display_.println(F("Disconnected"));
    return;
  }

  if (wifiSsid.length() <= OLED_SSID_MAX_CHARS) {
    display_.println(wifiSsid);
    return;
  }

  for (std::size_t index = 0; index < OLED_SSID_PREFIX_CHARS; ++index) {
    display_.write(wifiSsid[index]);
  }
  display_.println(F("..."));
}

void DisplayService::drawDivider() {
  display_.drawLine(0, DIVIDER_Y, AppConfig::OLED_WIDTH - 1, DIVIDER_Y,
                    SSD1306_WHITE);
}

void DisplayService::copyText(char* destination, const char* source) {
  if (source == nullptr) {
    destination[0] = '\0';
    return;
  }

  std::strncpy(destination, source, TEXT_BUFFER_SIZE - 1);
  destination[TEXT_BUFFER_SIZE - 1] = '\0';
}
