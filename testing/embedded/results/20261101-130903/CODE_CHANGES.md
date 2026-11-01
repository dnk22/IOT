# Thay đổi mã nguồn

## Instrumentation có guard

- `firmware/platformio.ini`: profile thường OFF và profile `esp32dev-perf` ON.
- `firmware/src/perf/PerfMetrics.{h,cpp}`: metric fixed-size/ring buffer, không cấp phát động trong đường đo và không `Serial.print` trong critical section.
- `firmware/src/main.cpp`: timer T01/T02/T03/T07 và flush cuối loop.
- `firmware/src/sensors/SensorService.cpp`: tách DHT/LDR timing.
- `firmware/src/mqtt/MqttService.cpp`: T04 callback→return và T06 publish call.
- `firmware/src/automation/AutomationService.{h,cpp}`: rule count và sự kiện release T05.
- `firmware/src/actuators/ActuatorService.cpp`: ghi nhận GPIO write thực sự.

Khi flag OFF, API đo là inline no-op; MQTT payload, REST, UI và logic nghiệp vụ không đổi. Profile mặc định đã được build và sẽ được flash lại cuối phiên.

## Harness/bằng chứng

Các file mới trong `testing/embedded/scripts/` thực hiện capture/sanitize/analyze serial, snapshot/restore DB, kiểm thử API/hardware, production Automation host test và build checks. Host test liên kết trực tiếp `firmware/src/automation/AutomationService.cpp`; chỉ `ActuatorService`, Arduino runtime và Preferences được mock.

Không push/merge/PR. Prompt gốc là file untracked có sẵn và không bị sửa.

