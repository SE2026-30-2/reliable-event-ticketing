# GateKeep

> Bán vé và check-in sự kiện, chạy ổn kể cả khi mất mạng.

GateKeep là nền tảng bán vé sự kiện với **check-in bằng QR có chữ ký số**, hoạt động tin cậy ngay cả khi mạng tại cổng chập chờn. Nhà tổ chức tự tạo và vận hành sự kiện của mình; người mua đặt vé, thanh toán và quản lý vé trong tài khoản; nhân viên quét vé bằng ứng dụng web offline-first. Mọi lần quét đều được ghi lại, và một vé không thể được dùng quá số lượt cho phép — kể cả khi nhiều thiết bị cùng quét một lúc.

## Tính năng

**Người mua**
- Tìm sự kiện, xem chi tiết, đặt vé với mã giảm giá (báo giá tức thì từ server), thanh toán qua VNPay hoặc chế độ mô phỏng.
- Vé gắn với tài khoản, xem được trên mọi thiết bị; gửi lại email vé; **chuyển nhượng vé** cho tài khoản khác (QR cũ vô hiệu ngay).
- **Danh sách chờ** khi hết vé: có chỗ trống thì được giữ vé tự động và nhận email để thanh toán.
- Bắt buộc xác minh email trước khi mua.

**Nhà tổ chức**
- Console quản lý sự kiện: nháp/xuất bản/hủy, loại vé (giá, hạn mức, vé nhiều lượt vào, gói nhiều vé), mã giảm giá, danh sách khách mời miễn phí.
- Đăng ký thiết bị check-in cho từng sự kiện; theo dõi dòng người vào theo thời gian thực và theo khung giờ.
- Báo cáo doanh thu, hoàn tiền, giảm giá, tỉ lệ có mặt; xuất CSV người tham dự và thanh toán.
- Dữ liệu cô lập giữa các nhà tổ chức: người này không thấy, không dò được sự kiện của người khác.

**Check-in tại cổng**
- Quét bằng camera, máy quét phần cứng (USB/Bluetooth) hoặc dán mã; kết quả cỡ lớn dễ đọc.
- **Offline-first**: tự xác minh chữ ký và khung giờ hợp lệ ngay trên thiết bị, xếp hàng các lần quét và đồng bộ khi có mạng (retry lùi dần, idempotent).
- Chống dùng lại vé theo thứ tự commit trên server, không tin đồng hồ thiết bị; hỗ trợ vé nhiều lượt vào.
- Audit log đầy đủ: mọi lần quét, thành công hay không, là một bản ghi bất biến.

**Quản trị nền tảng**
- Cấp/thu quyền nhà tổ chức, hoàn tiền, xem mọi sự kiện.

## Kiến trúc

```text
          React Frontend (:5173)
   mua vé │ check-in (offline) │ console nhà tổ chức
          │                    │
          v                    v
 ┌──────────────────┐   ┌──────────────────────────────────────┐
 │  user-service     │   │  ticketing-platform (:8091)           │
 │  (:8087)          │   │  ┌─────────┬─────────┬─────────────┐ │
 │  Identity Provider│◄──│  │ catalog │ payment │   checkin   │ │
 │  JWT RS256 / JWKS │JWT│  ├─────────┴─┬───────┴─┬───────────┤ │
 │  PostgreSQL       │   │  │ reporting │ notification │ shared│ │
 └──────────────────┘   │  └───────────┴─────────┴───────────┘ │
                         │  PostgreSQL (ticketing_platform)      │
                         └───────────────┬──────────────────────┘
                                         │ Kafka (outbox → relay → listeners)
                                    Zookeeper + Broker (+ Kafka UI)
```

- **Modular monolith** (`ticketing-platform`): năm module nghiệp vụ trong một ứng dụng, tách bằng package và giao tiếp bằng event qua Kafka với outbox pattern — giữ ranh giới rõ ràng mà không tốn chi phí vận hành của nhiều service.
- **Identity Provider tách riêng** (`user-service`): phát JWT RS256; `ticketing-platform` chỉ xác minh qua JWKS, không chia sẻ secret.
- **Hai miền chữ ký độc lập**: JWT đăng nhập (user-service) và QR vé (catalog) dùng hai khóa riêng.
- **Tính đúng đắn dựa vào PostgreSQL**: quota, hàng đợi, đếm lượt vào và outbox đều dùng khóa dòng/advisory lock và ràng buộc DB.

Chi tiết và các quyết định thiết kế: [docs/architecture.md](docs/architecture.md).

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Backend | Java 21, Spring Boot 3.3, Spring Security (OAuth2 Resource Server), Spring Data JPA, Flyway, Spring Kafka, Spring Mail, ZXing |
| Dữ liệu & hạ tầng | PostgreSQL 16, Apache Kafka (Confluent 7.5), Docker Compose, GitHub Actions |
| Frontend | React 18, TypeScript, Vite, WebCrypto, IndexedDB, Service Worker (PWA) |
| Thanh toán | VNPay (sandbox/production) hoặc mô phỏng, sau một cổng `OnlinePaymentPort` |
| Kiểm thử | JUnit 5, Mockito, Spring MockMvc, Testcontainers (Postgres + Kafka), Vitest |

## Bắt đầu nhanh

Yêu cầu: JDK 21, Node.js 20+, Docker Compose v2.

```bash
cp .env.example .env     # bắt buộc: mật khẩu DB không có mặc định; bản mẫu bật chế độ demo

# Build jar (Dockerfile chỉ COPY target/*.jar)
(cd backend/user-service && ./mvnw -DskipTests clean package)
(cd backend/ticketing-platform && ./mvnw -DskipTests clean package)

docker compose up -d --build      # user-service, ticketing-platform, 2 Postgres, Kafka, Kafka UI

cd frontend && npm install && npm run dev      # http://localhost:5173
```

Ở chế độ demo (`.env.example`) có sẵn tài khoản ADMIN `admin@commerceforge.local` / `Admin@12345`, email không cần xác minh và thanh toán mô phỏng. **Môi trường thật không có tài khoản này** — xem [Chạy local và vận hành](docs/setup.md) để biết cách tạo ADMIN đầu tiên, cấu hình SMTP (xác minh email, gửi vé) và bật VNPay.

## Cấu trúc thư mục

```text
.
├── backend/
│   ├── ticketing-platform/   # catalog, payment, checkin, reporting, notification, shared
│   └── user-service/         # đăng ký/đăng nhập, xác minh email, role, JWT RS256/JWKS
├── frontend/                 # React + TypeScript + Vite
├── docs/                     # tài liệu kỹ thuật
├── docker-compose.yml
└── .github/workflows/backend-ci.yml
```

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [Kiến trúc](docs/architecture.md) | module, event, chữ ký, vòng đời vé, thanh toán, check-in, bảo mật, quyết định thiết kế |
| [Luồng nghiệp vụ](docs/business-flows.md) | từng luồng từ góc nhìn người dùng: chuẩn bị sự kiện, mua vé, check-in, chuyển nhượng, danh sách chờ, báo cáo |
| [Cơ sở dữ liệu](docs/database.md) | schema, ràng buộc, các index quan trọng |
| [API Reference](docs/api/README.md) | endpoint, phân quyền, request/response, mã lỗi |
| [Chạy local và vận hành](docs/setup.md) | cài đặt, biến môi trường, VNPay, SMTP, vận hành, xử lý sự cố |
| [Frontend](frontend/README.md) | trang, route, check-in offline, PWA |

## Kiểm thử

```bash
cd backend/ticketing-platform
./mvnw test                  # unit + web/security test (không cần Docker)
./mvnw test -Dtest='*IT'     # Postgres + Kafka thật qua Testcontainers (cần Docker)
cd ../user-service && ./mvnw test
cd ../../frontend && npm test && npm run build
```

Các test tích hợp đáng chú ý: `CheckinRecordConcurrencyIT` (nhiều thiết bị quét đồng thời: đúng số lượt, đánh số liên tục, vé đã void không bao giờ được nhận), `ReservationPaymentFlowIT` (đặt chỗ → thanh toán → phát hành/hủy/hết hạn qua Kafka), `VnpayPaymentFlowIT` (IPN có chữ ký, đối soát, hoàn tiền), `LifecycleIT` (coupon, gói, đơn miễn phí, chuyển nhượng so với cổng check-in, danh sách chờ, khách mời, báo cáo). `ManagementEndpointsSecurityTest` kiểm tra qua security chain thật rằng nhà tổ chức chỉ chạm được sự kiện của mình.

## Trạng thái và giới hạn đã biết

- **VNPay** được cài đặt theo tài liệu công khai và kiểm thử bằng chữ ký tính độc lập cùng server giả, nhưng **chưa chạy với sandbox thật** (cần credential merchant). Mặc định là thanh toán mô phỏng.
- **Chưa có deploy production**: TLS, backup, giám sát/cảnh báo và load test chưa làm.
- Khóa ký QR là file PEM local, chưa có secret manager hay rotation.
- Thiết bị đang offline chưa biết vé vừa bị void hoặc chuyển nhượng; server từ chối khi đồng bộ.
- Nhà tổ chức là **một tài khoản** (chưa có tổ chức nhiều thành viên); rate limit lưu theo từng instance (đã tách sau interface để thay bằng kho chung khi chạy nhiều instance).
- Email chỉ gửi được khi đã cấu hình SMTP.

Danh sách đầy đủ: [docs/architecture.md](docs/architecture.md#hạn-chế-và-hướng-phát-triển).
