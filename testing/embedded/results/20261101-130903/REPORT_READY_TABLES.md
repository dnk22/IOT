# Bảng dùng cho báo cáo Hệ thống nhúng

## 2.6 — Cấu hình kiểm thử

| Thành phần | Giá trị |
|---|---|
| Vi điều khiển | ESP32-D0WD-V3, 240 MHz, 4 MB Flash |
| Sensor | DHT22 GPIO18; LDR ADC GPIO34 |
| Ngoại vi | OLED I2C SDA21/SCL22; relay active-low GPIO25/26 |
| Chu kỳ danh định | Sensor 2.000 ms; status 10.000 ms |
| Firmware | 0.5.0; commit `40ff4f3...` |
| Phương pháp | Baseline thường 120 mẫu; perf soak 314 mẫu/628,956 s; host test production AutomationService |

## 3.1 — Kết quả chu kỳ và sensor

| Chỉ tiêu | n | Trung bình | Median | p95 | Min–Max |
|---|---:|---:|---:|---:|---:|
| Interval baseline | 119 | 2.000,017 ms | 2.000 ms | 2.000 ms | 2.000–2.001 ms |
| Interval perf | 313 | 2.009,367 ms | 2.000 ms | 2.050 ms | 1.999–2.065 ms |
| Sensor read perf | 314 | 7.056,911 µs | 6.894,5 µs | 7.697 µs | 936–7.903 µs |

Nhận xét: firmware thường bám chu kỳ 2 giây rất sát. Instrumentation/Serial làm tăng jitter, vì vậy phải tách hai cấu hình khi kết luận.

## 3.2 — Automation và điều khiển

| Chỉ tiêu | Kết quả |
|---|---|
| Evaluate 0 rule | median 133 µs; p95 145 µs; max 152 µs |
| MQTT callback→GPIO/return | GPIO_CHANGED mean 1.127,25 µs; max 1.198 µs |
| Manual hardware | Fan ON/OFF và Buzzer ON/OFF độc lập: PASS qua ACK + reported status |
| Resolver host | Priority createdSequence, release/cancel, master-off, disable/delete, per-actuator override/resume: PASS |
| Chống chatter | State giống nhau không tạo thêm GPIO write: PASS |

## 3.3 — MQTT và ứng dụng

| Chỉ tiêu | Kết quả |
|---|---:|
| Telemetry publish call median/p95 | 4.994 / 6.144 µs |
| Status publish call median/p95 | 4.949 / 6.688 µs |
| Request→HTTP 202 | 3,464 ms |
| Request→ESP32 ACK | 527,326 ms |
| Request→reported status | 554,513 ms |

Không đồng nhất `publish()` với RTT, HTTP 202 với relay applied, hoặc GPIO return với đóng tiếp điểm vật lý.

## 3.4 — RAM/Flash

| Build | RAM | Flash |
|---|---:|---:|
| Normal | 49.604 B (15,1%) | 962.793 B (73,5%) |
| Perf | 50.780 B (15,5%) | 967.085 B (73,8%) |

Perf overhead: 1.176 B RAM và 4.292 B flash. Free heap giảm 1.592 B qua cửa sổ soak; chưa đủ bằng chứng để kết luận leak.

## 3.5 — Độ ổn định

| Thời lượng | Mẫu | DHT error | MQTT fail | Reset/Panic |
|---:|---:|---:|---:|---:|
| 628,956 s | 314 | 0 | 0 | 0 |

Đây chỉ là kiểm thử ngắn khoảng 10,5 phút, không thay thế soak nhiều giờ/ngày.

## 3.6 — Giới hạn

- Điện áp, dòng, công suất và Wh: **NOT_MEASURED**.
- Không có feedback vật lý để chứng minh quạt quay hay tiếp điểm relay đóng.
- 8/16 rule chỉ kiểm tra correctness trên host; timing/heap hardware chưa đo để bảo toàn config thật.
- Không chủ động ngắt Wi-Fi/broker dùng chung; LWT ungraceful và degraded loop hardware còn BLOCKED.

