#include "network/WifiService.h"

#include <WiFi.h>

#include "AppConfig.h"
#include "Secrets.h"

void WifiService::begin() {
  WiFi.mode(WIFI_STA);
  startConnection();
}

void WifiService::loop() {
  const bool connected = isConnected();

  if (connected && !wasConnected_) {
    wasConnected_ = true;
    Serial.print(F("[WiFi] Connected. IP: "));
    Serial.print(getIpAddress());
    Serial.print(F(" RSSI: "));
    Serial.print(getRssiDbm());
    Serial.println(F(" dBm"));
    return;
  }

  if (!connected && wasConnected_) {
    wasConnected_ = false;
    Serial.println(F("[WiFi] Disconnected. Retry scheduled."));
  }

  const std::uint32_t nowMs = millis();
  if (!connected &&
      nowMs - lastConnectionAttemptMs_ >=
          AppConfig::WIFI_RECONNECT_INTERVAL_MS) {
    startConnection();
  }
}

bool WifiService::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

String WifiService::getSsid() const {
  return isConnected() ? WiFi.SSID() : String();
}

std::int32_t WifiService::getRssiDbm() const {
  return isConnected() ? WiFi.RSSI() : 0;
}

String WifiService::getIpAddress() const {
  return isConnected() ? WiFi.localIP().toString() : String();
}

void WifiService::startConnection() {
  lastConnectionAttemptMs_ = millis();
  Serial.println(F("[WiFi] Connecting to configured network..."));
  WiFi.begin(Secrets::WIFI_SSID, Secrets::WIFI_PASSWORD);
}
