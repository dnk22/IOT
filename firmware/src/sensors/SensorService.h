#pragma once

#include <DHT.h>

#include "models/Models.h"

class SensorService {
 public:
  SensorService();

  void begin();
  SensorReading read();

 private:
  DHT dht_;
};

