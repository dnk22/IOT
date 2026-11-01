#pragma once

#include <cstddef>

#include "Arduino.h"

inline std::size_t hostPreferencesPutCount = 0;

class Preferences {
 public:
  bool begin(const char*, bool) { return true; }
  void end() {}
  String getString(const char*, const char* fallback) { return String(fallback); }
  std::size_t putString(const char*, const String& value) {
    ++hostPreferencesPutCount;
    return value.length();
  }
};

