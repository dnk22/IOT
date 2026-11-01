# Trạng thái bàn giao

- Firmware trên ESP32: profile `esp32dev` mặc định, `ENABLE_EMBEDDED_PERF_TEST=0`.
- Flash normal: hash từng vùng đã verify; build RAM 49.604 B, flash 962.793 B.
- Serial hậu kiểm: 3 mẫu sensor, không có `[PERF]`.
- FAN: OFF; BUZZER: OFF.
- Manual override: FAN=false, BUZZER=false.
- Automation: enabled=true, configVersion=28, appliedVersion=28, syncState=SYNCED, 0 rules.
- NVS không bị erase/factory reset.
- DB: 85/85 dòng pre-test đã merge lại; không xóa telemetry test mới; `missingPreservedRows=0`.
- Backend hiện hữu không bị dừng; không có backend thứ hai được để lại.
- Không push/merge/PR.

Lưu ý: status ngay sau upload từng tạm thời `online=false` do cache TTL; sau status mới từ reboot, thiết bị trở lại online/MQTT connected với uptime 3.210 ms và outputs OFF.

