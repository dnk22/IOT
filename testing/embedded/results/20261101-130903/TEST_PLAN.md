# Kế hoạch kiểm thử

| ID | Mục tiêu | Phương pháp / nguồn | Tiêu chí |
|---|---|---|---|
| T01 | Chu kỳ sensor | Serial ESP32, baseline ≥120 và soak ≥10 phút | Gần 2.000 ms, thống kê n/min/mean/median/p95/max/stddev |
| T02 | Thời gian đọc sensor | `micros()`: toàn `read()`, DHT, LDR | Giá trị hữu hạn, đơn vị µs, không đổi semantics |
| T03 | Automation evaluate | `micros()` bao quanh production `evaluate()` | Thống kê theo rule count; nêu rõ chỉ có 0 rule trên hardware |
| T04 | Command đến GPIO/return | callback MQTT trước decode → sau resolver/actuator return | Có `GPIO_CHANGED`/`NO_CHANGE`, tương quan lệnh API/ACK |
| T05 | Release 5 giây | Host test production service; hardware chỉ khi không phá config | ACTIVE→RELEASING, <5 s giữ claim, ≥5 s release, true hủy timer |
| T06 | MQTT publish call | Bao quanh `PubSubClient::publish()` | Không gọi đây là RTT mạng |
| T07 | Vòng lặp | Ring buffer cố định, lấy mẫu 100 ms | p95/max và spike; không suy diễn non-blocking |
| T08 | RAM/Flash/heap | PlatformIO size + ESP heap mỗi 10 s | free/min-free/max-alloc/sketch, rule count |
| T09 | Soak | Serial ≥600 s | Không reset/panic, DHT error/publish fail đếm được |
| F01 | Safe boot/OLED | Source + reported state; serial nếu bắt được | preload relay OFF trước OUTPUT; OLED init không fail |
| F02 | Sensor hợp lệ/không hợp lệ | Hardware hợp lệ + host invalid DHT | valid đúng; invalid thành NaN/false và Automation coi condition false |
| F03 | Manual độc lập | Xung ngắn qua REST→MQTT→ACK/status | Từng actuator ON/OFF, actuator kia giữ nguyên |
| F04–F08 | Automation/resolver | Production service host với mock relay | activate/release/disable/delete/precedence/override/resume đúng |
| F09 | Không chatter | Metric GPIO hardware + host write counter | State giống nhau không tạo GPIO write mới |
| F10 | Config validation/NVS write | Production service host | stale/duplicate/conflict/capacity reject; idempotent không ghi NVS |
| F11 | NVS qua reboot | Chỉ hardware nếu phân biệt được retained config và NVS | Không suy diễn khi thiếu bằng chứng |
| F12 | Local khi backend/network lỗi | Static/isolated; không ngắt Wi-Fi Mac | Nêu BLOCKED nếu không fault-inject an toàn |
| F13 | Availability/LWT/UNKNOWN | Backend smoke + static MQTT contract | Tách software handler và broker hardware |
| F14 | 0/8/16/17 rule | 0 rule hardware; 16/17 host | 17 bị từ chối; không sửa rule thật |
| F15 | OLED/sensor trong reconnect | Static + quan sát nếu reconnect tự nhiên | Không tạo sự cố mạng chủ động |
| API | REST/WebSocket/SQLite | Read-only endpoints + hardware command ACK | 2xx/4xx đúng, telemetry mới, thứ tự/unique đúng |
| POWER | Điện năng | Không có đồng hồ đo | `NOT_MEASURED`, không ước lượng thành số đo |

Mọi timer dùng phép trừ unsigned để chịu wraparound. GPIO software không chứng minh tiếp điểm relay hay quạt quay; HTTP 202 không được tính là xác nhận nếu thiếu ACK/status ESP32.

