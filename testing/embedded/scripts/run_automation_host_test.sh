#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
output_binary="${TMPDIR:-/tmp}/iot-automation-host-test"

clang++ -std=c++17 -O2 \
  -DARDUINO=100 \
  -DARDUINOJSON_ENABLE_ARDUINO_STREAM=0 \
  -DARDUINOJSON_ENABLE_ARDUINO_PRINT=0 \
  -DARDUINOJSON_ENABLE_PROGMEM=0 \
  -I"$repo_root/testing/embedded/host_stubs" \
  -I"$repo_root/firmware/include" \
  -I"$repo_root/firmware/src" \
  -I"$repo_root/firmware/.pio/libdeps/esp32dev/ArduinoJson/src" \
  "$repo_root/testing/embedded/scripts/automation_host_test.cpp" \
  "$repo_root/firmware/src/automation/AutomationService.cpp" \
  -o "$output_binary"

"$output_binary"
