# Blocker và phần chưa đo

| Hạng mục | Trạng thái | Lý do / bước tối thiểu tiếp theo |
|---|---|---|
| Dòng, áp, công suất, Wh thực | NOT_MEASURED | Không có ampe kế/power analyzer; cần USB power meter cho ESP32 và phép đo riêng nguồn 5 V tải relay/fan/buzzer, không cộng bằng dòng danh định 3,3 V |
| Tiếp điểm relay/quạt thực quay | BLOCKED | Không có tachometer/current/contact feedback; software chỉ xác nhận GPIO và state |
| Hardware 8/16 rule timing/heap | BLOCKED | Tránh phá ID/precedence/config retained/NVS thật; mới có 0-rule hardware và 16/17 host correctness |
| Release T05 trên hardware | BLOCKED | Không tạo rule tạm trên cấu hình thật; production service host đã kiểm tra timer/cancel |
| NVS-only restore sau reboot | BLOCKED | Broker retained config có thể che nguồn restore; cần broker test cô lập hoặc hook không phá NVS |
| Wi-Fi/MQTT degraded loop | BLOCKED | Không được ngắt Wi-Fi Mac/broker dùng chung; cần broker cô lập hoặc compile-time endpoint fault hook |
| LWT ungraceful trên broker thật | BLOCKED | Không chủ động cắt mạng/process dùng chung; backend handler/contract được kiểm thử software |
| OLED pixel/hiển thị vật lý | BLOCKED | Không có camera/screenshot tự động; chỉ source init và không thấy log init failure trong cửa sổ quan sát |
| Frontend browser E2E trực quan | BLOCKED | Không có browser harness; build/typecheck, REST recent và source merge/dedupe được xác minh |

Giới hạn quan trọng: `PubSubClient::publish()` duration không phải RTT; timer GPIO software không phải thời gian đóng tiếp điểm; quan sát 10 phút không chứng minh ổn định dài hạn; heap generic không tách từng capability/region của ESP32.
