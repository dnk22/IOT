# Kết quả kiểm thử hệ nhúng ESP32 Smart Room

## Tóm tắt

| ID | Kết quả | Nguồn | Kết luận ngắn |
|---|---|---|---|
| Build | PASS | STATIC | Firmware normal/perf, Backend typecheck/verify, Frontend typecheck/build đều exit 0 |
| T01 | PASS | HARDWARE | Baseline 120 mẫu và perf soak 314 mẫu; xem bảng timing |
| T02 | PASS | HARDWARE | Sensor read median 6.894,5 µs; DHT/LDR được đo riêng |
| T03 | PASS | HARDWARE (0 rule) | Evaluate median 133 µs; 8/16-rule hardware BLOCKED |
| T04 | PASS | HARDWARE | 4 GPIO_CHANGED: mean 1.127,25 µs; NO_CHANGE được ghi riêng |
| T05 | PASS | SIMULATION | Production service giữ claim <5 s, release ≥5 s, true hủy release; hardware BLOCKED |
| T06 | PASS | HARDWARE | Telemetry `publish()` median 4.994 µs; request→ACK 527,326 ms cho lệnh NO_CHANGE |
| T07 | PASS | HARDWARE | Đã đo, không khẳng định non-blocking; p95 214.291 µs, max 243.139 µs |
| T08 | PASS | HARDWARE (0 rule) | RAM/Flash/heap ghi nhận; 8/16-rule hardware BLOCKED |
| T09 | PASS | HARDWARE | 628,956 s metric span, 0 reset/panic/DHT error/publish failure |
| F01 relay safe boot | PASS | STATIC + HARDWARE state | Source preload OFF trước OUTPUT; cuối test state OFF; không chứng minh tiếp điểm vật lý |
| F01 OLED vật lý | BLOCKED | — | Không có camera; không thấy log init failure nhưng chưa đủ chứng minh pixel |
| F02 valid sensor | PASS | HARDWARE | 314/314 mẫu soak DHT OK; LDR nằm trong 0..4095 |
| F02 invalid sensor | PASS | SIMULATION/STATIC | NaN+dhtValid=false làm condition false; không tháo dây live |
| F03 manual Fan/Buzzer | PASS | HARDWARE | ON/OFF độc lập, HTTP 202 + correlated ACK + reported status; xung ngắn |
| F04–F08 | PASS | SIMULATION | Production `AutomationService.cpp`: ACTIVE/release, disable/delete, priority, override/resume |
| F09 | PASS | HARDWARE + SIMULATION | 4 transition GPIO; các lệnh OFF lặp lại là NO_CHANGE, không thêm GPIO write |
| F10 | PASS | SIMULATION | stale/conflict/17-rule reject; identical version idempotent không ghi NVS |
| F11 | BLOCKED | — | Retained config có thể che nguồn NVS sau reboot |
| F12 | BLOCKED | STATIC | Không chủ động ngắt Backend/Wi-Fi dùng chung; source không có offline telemetry queue/backfill |
| F13 | PASS | SOFTWARE | Backend presence/LWT/UNKNOWN smoke PASS; broker ungraceful hardware BLOCKED |
| F14 | PASS | SIMULATION | 16 rule accepted, 17 rejected; hardware timing/heap 8/16 BLOCKED |
| F15 | BLOCKED | — | Không fault-inject reconnect an toàn; online soak cadence/OLED loop vẫn chạy |
| REST/API/DB | PASS | HARDWARE/SOFTWARE | Endpoint 200/4xx đúng, config 28 SYNCED, 85/85 DB rows phục hồi |
| Điện năng | NOT_MEASURED | — | Không có dụng cụ đo; không tạo số liệu giả |

## Timing và overhead

| Metric | n | min | mean | median | p95 | max | stddev | Đơn vị |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| T01 baseline, instrumentation OFF | 119 | 2.000 | 2.000,017 | 2.000 | 2.000 | 2.001 | 0,129 | ms |
| T01 perf soak | 313 | 1.999 | 2.009,367 | 2.000 | 2.050 | 2.065 | 19,003 | ms |
| T02 SensorService::read | 314 | 936 | 7.056,911 | 6.894,5 | 7.697 | 7.903 | 536,483 | µs |
| T02 DHT portion | 314 | 65 | 6.447,379 | 6.284,5 | 7.024 | 7.139 | 531,659 | µs |
| T02 LDR portion | 314 | 508 | 561,293 | 528 | 633 | 1.013 | 68,481 | µs |
| T03 evaluate, 0 rules | 314 | 61 | 113,768 | 133 | 145 | 152 | 30,849 | µs |
| T04 callback→return, GPIO_CHANGED | 4 | 1.052 | 1.127,25 | 1.129,5 | 1.198 | 1.198 | 61,625 | µs |
| T04 callback→return, NO_CHANGE | 6 | 887 | 973,333 | 997 | 1.032 | 1.032 | 62,409 | µs |
| T06 telemetry publish call | 314 | 2.567 | 5.132,029 | 4.994 | 6.144 | 7.586 | 514,763 | µs |
| T06 status publish call | 73 | 2.876 | 5.132,493 | 4.949 | 6.688 | 7.945 | 1.225,354 | µs |
| T07 main loop sampled | 4.032 | 313 | 15.480,917 | 347 | 214.291 | 243.139 | 57.023,894 | µs |

Instrumentation làm mean interval tăng khoảng 9,35 ms và p95 tăng 50 ms so với baseline. Vì vậy số soak không đại diện profile thường. T07 bao gồm OLED, MQTT loop và chính flush metric cuối loop; spike không được gán chắc chắn cho một thành phần nếu chưa có trace sâu hơn. DHT min 65 µs phù hợp một lần thư viện trả cached read khi khoảng gọi sát ngưỡng 2 giây; không dùng min này làm thời gian giao tiếp DHT22 điển hình.

## Bộ nhớ

| Hạng mục | Firmware thường | Perf |
|---|---:|---:|
| Static RAM | 49.604 / 327.680 B (15,1%) | 50.780 / 327.680 B (15,5%) |
| Flash program | 962.793 / 1.310.720 B (73,5%) | 967.085 / 1.310.720 B (73,8%) |
| Overhead perf | — | +1.176 B RAM, +4.292 B flash |

Trong soak 0 rule: free heap 191.704 → 190.112 B (delta -1.592 B); min-free cuối 162.576 B, minimum quan sát 162.576 B; max alloc block giữ 110.580 B; sketch runtime 973.664 B. Cửa sổ 10 phút không đủ kết luận memory leak; max alloc/free chỉ là heap API tổng quát ESP32.

## MQTT/API/Frontend

- 314 telemetry publish thành công trong soak, 0 failure; Backend nhận 3 dòng mới trong 6,5 giây, unique và theo thứ tự tăng dần.
- Lệnh NO_CHANGE: request→HTTP 202 = 3,464 ms; request→ESP32 command ACK = 527,326 ms; request→reported status = 554,513 ms. Đây là latency end-to-end ứng dụng local, không phải thời gian đóng tiếp điểm.
- Hardware pulses có ACK/state chính ESP32; UI dùng reported status để kết thúc pending, không chỉ HTTP 202.
- Frontend source fetch recent, sort/merge theo `receivedAtMs`, dedupe bằng `Map`, WebSocket append; typecheck/build PASS. Browser visual E2E chưa chạy.
- MQTT topics firmware/shared khớp `telemetry/status/availability/command/command/ack/config/config/ack`; config Backend QoS 1 retained, device LWT offline QoS 1 retained.

## Sự cố và phục hồi

Một lần gọi nhầm `yarn dev` trong race kiểm tra cổng đã chạy `resetTelemetry.ts` rồi fail `EADDRINUSE`. Backup trước test còn nguyên 85 dòng gốc. Script phục hồi đã tạo `database-pre-restore.sqlite`, merge bằng primary key, chèn 85/85, `missingPreservedRows=0`, không xóa telemetry mới. Snapshot cuối cho thấy 487 dòng, automation config/applied = 28 `SYNCED`, 0 rules, outputs OFF.

Profile perf dùng Adafruit GFX 1.13.0 do môi trường libdeps riêng tự resolve, trong khi profile thường cache 1.12.6. Đây là confounder nhỏ được giữ minh bạch; timing OLED/T07 không được dùng để so sánh thư viện tuyệt đối.

Firmware thường đã flash lại; serial cuối có 3 mẫu và không có dòng `[PERF]`. Xem `serial-restored-normal.log` và trạng thái phục hồi trong `RESTORE_STATE.md`.

