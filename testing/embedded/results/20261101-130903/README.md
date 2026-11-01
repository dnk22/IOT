# Bộ bằng chứng kiểm thử ESP32 Smart Room

Phiên kiểm thử này dùng ESP32 thật tại `/dev/cu.usbserial-0001`, firmware commit `40ff4f3306d6898572dff628bec9edc196df5504`, cùng Backend local và broker đã cấu hình sẵn. Không có bí mật Wi-Fi/MQTT hoặc IP riêng được ghi vào bộ kết quả.

## Chạy lại

Từ thư mục `iot-smart-room`:

```sh
python3 testing/embedded/scripts/run_build_checks.py --repo . --output testing/embedded/results/<run>/build.log
sh testing/embedded/scripts/run_automation_host_test.sh
/Users/duynk/.platformio/penv/bin/python testing/embedded/scripts/capture_serial.py --port /dev/cu.usbserial-0001 --output testing/embedded/results/<run>/serial.log --duration 630
```

Flash đo hiệu năng chỉ khi đã nhận diện chắc chắn cổng:

```sh
cd firmware
pio run -e esp32dev-perf -t upload --upload-port /dev/cu.usbserial-0001
# Sau kiểm thử, khôi phục profile mặc định (instrumentation OFF):
pio run -e esp32dev -t upload --upload-port /dev/cu.usbserial-0001
```

Không dùng `erase_flash`. Không chạy `backend/yarn dev` trên DB cần giữ vì script đó xóa `sensor_readings`; `yarn verify` an toàn vì dùng DB tạm.

## Phân loại bằng chứng

- `HARDWARE`: timestamp/phản hồi do ESP32 thật phát ra.
- `SIMULATION`: production `AutomationService.cpp` chạy trên host với mock actuator, không phải relay vật lý.
- `STATIC`: build hoặc kiểm tra mã nguồn/hợp đồng.
- `NOT_MEASURED`: không có thiết bị đo phù hợp.

`serial-baseline.log` là firmware chưa instrument; `serial-soak.log` là profile perf; `metrics.csv/json` là dữ liệu đã phân tích. Trạng thái và giới hạn được tổng hợp trong `RESULTS.md` và `BLOCKERS.md`.

## An toàn và phục hồi

Fan chỉ bật khoảng 1 giây, buzzer khoảng 0,5 giây. Script `hardware_control_test.mjs` luôn gửi OFF trong `finally`, sau đó resume Automation riêng cho từng actuator. Snapshot SQLite trước test nằm ở `database-before.sqlite`; thao tác merge phục hồi có bằng chứng riêng và không xóa dòng telemetry mới.

