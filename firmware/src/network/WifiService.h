#pragma once

#include <Arduino.h>
#include <cstdint>

class WifiService {
 public:
  void begin();
  void loop();

  bool isConnected() const;
  String getSsid() const;
  std::int32_t getRssiDbm() const;
  String getIpAddress() const;

 private:
  void startConnection();

  std::uint32_t lastConnectionAttemptMs_ = 0;
  bool wasConnected_ = false;
};
