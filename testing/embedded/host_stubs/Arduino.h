#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

#define F(value) value

class String {
 public:
  String() = default;
  String(const char* value) : value_(value == nullptr ? "" : value) {}
  String(const std::string& value) : value_(value) {}

  String& operator=(const char* value) {
    value_ = value == nullptr ? "" : value;
    return *this;
  }
  bool operator==(const String& other) const { return value_ == other.value_; }
  bool isEmpty() const { return value_.empty(); }
  const char* c_str() const { return value_.c_str(); }
  std::size_t length() const { return value_.size(); }
  bool concat(const char* value) {
    if (value != nullptr) value_ += value;
    return true;
  }

 private:
  std::string value_;
};

struct SerialStub {
  template <typename T> void print(const T&) {}
  template <typename T> void println(const T&) {}
  void println() {}
};

inline SerialStub Serial;
inline std::uint32_t hostMillis = 0;
inline std::uint32_t millis() { return hostMillis; }

