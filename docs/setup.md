# GateKeep - Chạy local và vận hành

## Yêu cầu

- **JDK 21** (cần `javac`, không chỉ JRE — build lỗi `release version 21 not supported` nghĩa là máy chỉ có JRE; đặt `JAVA_HOME` tới một JDK 21)
- Maven Wrapper (`mvnw`) có sẵn trong từng module, không cần cài Maven
- Node.js 20+ và npm (frontend)
- Docker Engine + Docker Compose v2 (`docker compose`)

## Chạy toàn bộ bằng Docker Compose

Cần file `.env` (không nằm trong git): compose **từ chối chạy** nếu thiếu mật khẩu DB. Dockerfile của từng app chỉ `COPY target/*.jar`, nên **phải build jar trước** (dùng `clean` để không sót file cũ trong `target/`):

```bash
cp .env.example .env     # rồi sửa mật khẩu; bản mẫu đã bật chế độ demo (xem bảng dưới)

(cd backend/user-service && ./mvnw -DskipTests clean package)
(cd backend/ticketing-platform && ./mvnw -DskipTests clean package)

docker compose up -d --build
docker compose ps        # đợi tất cả (healthy), app mất ~40s
```

Frontend chạy riêng (không nằm trong compose):

```bash
cd frontend
cp .env.example .env     # tùy chọn: mặc định đã trỏ localhost:8087 / localhost:8091
npm install
npm run dev              # http://localhost:5173
```

Dừng: `docker compose down` (thêm `-v` để xóa cả volume DB và khóa ký). Đổi `*_DB_PASSWORD` sau khi volume đã tạo **không** đổi mật khẩu trong DB cũ — cần `down -v` (mất dữ liệu) hoặc `ALTER USER`.

## Bảng port

| Thành phần | Host port | Ghi chú |
|---|---|---|
| Frontend (Vite dev) | 5173 | |
| `ticketing-platform` | 8091 | container nghe 8080 (`SERVER_PORT`), map `8091:8080`; Swagger `/swagger-ui.html` |
| `user-service` | 8087 | Swagger `/swagger-ui.html` |
| Kafka UI | 8086 | chỉ bind loopback |
| Kafka broker | 9092 (host) / 29092 (trong mạng compose) | loopback |
| Zookeeper | 2181 | loopback |
| Postgres `ticketing_platform` | 5437 | loopback, user/pass `postgres/postgres` |
| Postgres `user_service` | 5436 | loopback |

## Biến môi trường

Compose đã đặt sẵn giá trị đúng cho mạng nội bộ; dưới đây là các biến đáng chú ý của `ticketing-platform` (mặc định khi chạy ngoài Docker nằm trong `application.properties`).

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SPRING_DATASOURCE_URL/USERNAME` | `jdbc:postgresql://localhost:5437/ticketing_platform` / `postgres` | DB |
| `SPRING_DATASOURCE_PASSWORD` | **bắt buộc, không có mặc định** | app không khởi động nếu thiếu; compose lấy từ `TICKETING_DB_PASSWORD` / `USER_DB_PASSWORD` trong `.env` |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | trong compose: `broker:29092` |
| `SECURITY_JWT_JWK_SET_URI` | `http://localhost:8087/.well-known/jwks.json` | nơi lấy public key của user-service |
| `TICKETING_QR_PRIVATE_KEY_PATH` | `./keys/ticket_signing_key.pem` | khóa ký QR; compose mount volume `ticketing-platform-keys` |
| `TICKETING_QR_REQUIRE_EXISTING_KEY` | `false` | `true` = không tự sinh khóa mới khi thiếu file (bật sau lần khởi động đầu, vì đổi khóa vô hiệu mọi QR đã phát) |
| `TICKETING_RESERVATION_EXPIRY_MINUTES` | `10` | thời gian giữ chỗ chưa thanh toán |
| `TICKETING_PAYMENT_SUCCESS_RATE` | `0.9` | tỉ lệ thành công của mock gateway khi không `forceOutcome` |
| `TICKETING_REQUIRE_VERIFIED_EMAIL` | `true` | đặt chỗ/danh sách chờ cần email đã xác minh (claim `email_verified`). `.env.example` đặt `false` để demo không cần SMTP; **để `true` ở môi trường thật** |
| `TICKETING_TRANSFER_MAX` / `TICKETING_TRANSFER_CUTOFF_MINUTES` | `2` / `60` | số lần một vé được chuyển nhượng (0 = tắt) / đóng chuyển nhượng trước giờ bắt đầu |
| `TICKETING_WAITLIST_INTERVAL_MS` | `30000` | chu kỳ job cấp quota cho danh sách chờ |
| `TICKETING_PAYMENT_PROVIDER` | `mock` | `mock` hoặc `vnpay`. Với `vnpay` phải có 3 biến dưới, thiếu thì app **không khởi động** |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | rỗng | mã website và khóa bí mật của tài khoản merchant VNPay (không commit) |
| `VNPAY_RETURN_URL` | rỗng | trang frontend người mua được đưa về, vd `http://localhost:5173/payment/result` |
| `VNPAY_PAY_URL`, `VNPAY_API_URL` | URL sandbox | đổi sang URL production khi chạy thật |
| `TICKETING_PAYMENT_RECONCILE_MS` | `60000` | chu kỳ job đối soát thanh toán VNPay |
| `TICKETING_PAYMENT_ALLOW_FORCE_OUTCOME` | `false` | cho phép client ép kết quả thanh toán (chỉ để demo; `.env.example` bật `true`). Khi `false`, gửi `forceOutcome` bị `400` |
| `TICKETING_RESERVATION_MAX_ACTIVE_PER_EMAIL` | `10` | số vé tối đa một **tài khoản** được giữ `RESERVED` cùng lúc (vượt → `429`) |
| `TICKETING_RATE_LIMIT_RESERVATIONS` / `_PAYMENTS` / `_RESENDS` / `_WINDOW_SECONDS` | `10` / `20` / `5` / `60` | giới hạn theo IP cho `POST …/reservations`, `POST /api/payment/requests`, `POST /api/ticket/{id}/resend`. Chuyển nhượng (5) và danh sách chờ (10) chỉnh bằng property `ticketing.rate-limit.transfers-per-window` / `waitlist-per-window` |
| `TICKETING_RATE_LIMIT_TRUST_FORWARDED_FOR` | `false` | `true` **chỉ** khi sau reverse proxy luôn ghi đè `X-Forwarded-For`; ngược lại client tự bịa IP để né giới hạn |
| `TICKETING_OUTBOX_RETENTION_DAYS` | `7` | giữ dòng outbox đã relay bao lâu trước khi xóa |
| `MANAGEMENT_ENDPOINTS_EXPOSURE` | `health,info` | endpoint Actuator được mở (cả hai app); thêm `prometheus` chỉ khi cổng được bảo vệ ở tầng mạng |
| `SPRING_FLYWAY_LOCATIONS` (user-service) | `classpath:db/migration` | `.env.example` thêm `classpath:db/dev-seed` để seed ADMIN demo — **không dùng ở nơi thật** |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | cả hai app |
| `FRONTEND_BASE_URL` | `http://localhost:5173` | dùng dựng link trong email xác thực/đặt lại mật khẩu |
| `MAIL_HOST/PORT/USERNAME/PASSWORD` | Mailtrap sandbox, rỗng | tài khoản SMTP; thiếu thì app vẫn chạy nhưng gửi mail lỗi (chỉ log) |
| `MAIL_FROM` | `no-reply@gatekeep.example` | địa chỉ gửi — **phải là sender/domain đã xác minh với nhà cung cấp SMTP**, nếu không mail bị từ chối |
| `MAIL_SMTP_AUTH` / `MAIL_STARTTLS` | `true` / `true` | cổng 587 của hầu hết nhà cung cấp cần cả hai |

Frontend (`frontend/.env`): `VITE_USER_SERVICE_URL` (mặc định `http://localhost:8087`), `VITE_TICKETING_SERVICE_URL` (mặc định `http://localhost:8091`).

## Thanh toán VNPay sandbox

1. Đăng ký merchant sandbox tại `sandbox.vnpayment.vn/devreg` — VNPay gửi email chứa `TmnCode` và `HashSecret` (đây là thông tin của riêng bạn; hệ thống **không** kèm sẵn).
2. `.env`: `TICKETING_PAYMENT_PROVIDER=vnpay`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_RETURN_URL=http://localhost:5173/payment/result`. Khởi động lại `ticketing-platform`.
3. **IPN cần URL công khai**: VNPay không gọi được `localhost`. Chạy `ngrok http 8091` rồi đăng ký `https://<id>.ngrok-free.app/api/payment/vnpay/ipn` trong cổng merchant (mục cấu hình IPN). Không có IPN vẫn chạy được: khi người mua quay về `/payment/result` và job đối soát (60s) sẽ hỏi lại VNPay bằng `querydr`.
4. Thẻ test của sandbox: ngân hàng **NCB**, số thẻ `9704198526191432198`, tên `NGUYEN VAN A`, ngày phát hành `07/15`, OTP `123456` (theo tài liệu VNPay; có thể thay đổi, xem trang demo của họ).
5. Giá vé nhập theo **1/100 đồng** (vé 50.000 ₫ → `priceCents: 5000000`); sandbox giới hạn mỗi giao dịch tối thiểu 5.000 ₫ và dưới 1 tỉ ₫.

Mã hóa chữ ký (HMAC-SHA512) được kiểm thử bằng giá trị tính độc lập bằng Python; tương thích với sandbox thật chỉ xác nhận được khi bạn có credential của mình — hãy chạy thử một giao dịch trước khi tin dùng.

## Chạy app ngoài Docker (hot reload)

Giữ hạ tầng trong compose, chạy app bằng Maven. Mật khẩu DB không còn mặc định trong code nên phải nạp từ `.env`:

```bash
docker compose up -d postgres-ticketing-platform postgres-user-service zookeeper broker
set -a; source .env; set +a
(cd backend/user-service && SPRING_DATASOURCE_PASSWORD=$USER_DB_PASSWORD SPRING_FLYWAY_LOCATIONS=$USER_SERVICE_FLYWAY_LOCATIONS ./mvnw spring-boot:run)   # :8087
(cd backend/ticketing-platform && SPRING_DATASOURCE_PASSWORD=$TICKETING_DB_PASSWORD TICKETING_PAYMENT_ALLOW_FORCE_OUTCOME=$TICKETING_PAYMENT_ALLOW_FORCE_OUTCOME ./mvnw spring-boot:run)   # :8091
```

Lần đầu `ticketing-platform` tự sinh khóa ký tại `./keys/ticket_signing_key.pem` (thư mục này bị `.gitignore`).

## Tài khoản mặc định

Chỉ khi `.env` có `USER_SERVICE_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/dev-seed` (bản `.env.example` đã bật), `user-service` seed một ADMIN: **`admin@commerceforge.local` / `Admin@12345`** — chỉ dùng local/dev/CI. Seed nằm ở `db/dev-seed/`, **không** thuộc migration mặc định nên một môi trường thật sẽ không có tài khoản mật khẩu công khai nào.

### Cấp quyền nhà tổ chức (ORGANIZER)

ADMIN vào trang **Users** của frontend bấm *Make organizer*, hoặc gọi API (người đó đăng nhập lại để token mang role mới):

```bash
curl -X PATCH localhost:8087/api/user/admin/users/<userId>/roles -H "$A" -H 'Content-Type: application/json' \
  -d '{"roles":["USER","ORGANIZER"]}'
```

Tài khoản ORGANIZER chỉ thấy và quản lý sự kiện **do chính mình tạo** (trang **Manage events**).

### Tạo ADMIN đầu tiên (môi trường thật)

1. Đăng ký tài khoản bình thường qua `POST /api/user/register` (role mặc định `USER`).
2. Nâng quyền trực tiếp trong DB một lần:
   ```sql
   -- trong database user_service
   INSERT INTO user_roles (user_id, role)
   SELECT id, 'ADMIN' FROM users WHERE email = 'ban@congty.vn';
   ```
3. Đăng nhập lại để JWT mới mang role `ADMIN`. Các ADMIN sau đó cấp bằng `PATCH /api/user/admin/users/{id}/roles`.

## Cấu hình email (SMTP)

Email dùng cho: xác minh tài khoản và đặt lại mật khẩu (user-service), vé kèm QR, thông báo vé bị hủy/hoàn/chuyển nhượng, và lời mời từ danh sách chờ (ticketing-platform). Điền vào `.env` rồi chạy `docker compose up -d user-service ticketing-platform`:

```text
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM=no-reply@ten-mien-cua-ban.vn   # phải là sender/domain đã xác minh với nhà cung cấp
```

- Để thử: Mailtrap sandbox (thư không tới hộp thư thật, xem trong web của họ). Để gửi thật: Gmail (dùng App Password, cần bật xác thực hai bước), SendGrid, Brevo, SES…
- Gửi lỗi **không làm hỏng luồng nghiệp vụ**: app chỉ ghi log (`docker compose logs ticketing-platform | grep -i email`) và không thử lại.
- Link trong email dùng `FRONTEND_BASE_URL` — đổi sang domain thật khi triển khai.
- Khi SMTP đã chạy, đặt `TICKETING_REQUIRE_VERIFIED_EMAIL=true` để bắt buộc xác minh email trước khi mua.

## Kiểm tra nhanh luồng đầy đủ bằng curl

Kịch bản dưới đây dùng người mua mới đăng ký, nên cần `TICKETING_REQUIRE_VERIFIED_EMAIL=false` (mặc định của `.env.example`); nếu để `true` thì đặt chỗ trả `403` cho tới khi email được xác minh.

```bash
TOKEN=$(curl -s -X POST localhost:8087/api/user/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@commerceforge.local","password":"Admin@12345"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
A="Authorization: Bearer $TOKEN"; J='Content-Type: application/json'

EVENT=$(curl -s -X POST localhost:8091/api/event -H "$A" -H "$J" \
  -d '{"name":"Rock Night","venue":"Hanoi Arena","startsAt":"2030-12-01T18:00:00Z","endsAt":"2030-12-01T23:00:00Z"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["eventId"])')

TT=$(curl -s -X POST localhost:8091/api/event/$EVENT/ticket-types -H "$A" -H "$J" \
  -d "{\"name\":\"GA\",\"priceCents\":100000,\"quota\":5,\"validFrom\":\"$(date -u +%FT%TZ)\",\"validUntil\":\"2030-12-02T00:00:00Z\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["ticketTypeId"])')

# người mua: đăng ký/đăng nhập một tài khoản thường
curl -s -X POST localhost:8087/api/user/register -H "$J" -d '{"email":"alice@example.com","password":"Passw0rd!!","fullName":"Alice"}' >/dev/null
BUYER=$(curl -s -X POST localhost:8087/api/user/login -H "$J" -d '{"email":"alice@example.com","password":"Passw0rd!!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
B="Authorization: Bearer $BUYER"

RES=$(curl -s -X POST localhost:8091/api/ticket-types/$TT/reservations -H "$B" -H "$J" \
  -d '{"quantity":1,"holderName":"Alice","holderEmail":"alice@example.com"}')
RID=$(echo "$RES" | python3 -c 'import sys,json;print(json.load(sys.stdin)["reservationId"])')
TID=$(echo "$RES" | python3 -c 'import sys,json;print(json.load(sys.stdin)["tickets"][0]["ticketId"])')

curl -s -X POST localhost:8091/api/payment/requests -H "$B" -H "$J" \
  -d "{\"reservationId\":\"$RID\",\"forceOutcome\":\"COMPLETED\"}"   # forceOutcome cần TICKETING_PAYMENT_ALLOW_FORCE_OUTCOME=true (đã bật trong .env.example)
sleep 2
QR=$(curl -s localhost:8091/api/ticket/$TID -H "$B" | python3 -c 'import sys,json;print(json.load(sys.stdin)["qrPayload"])')   # status ISSUED

KEY=$(curl -s -X POST localhost:8091/api/checkin/devices -H "$A" -H "$J" -d '{"label":"Gate A"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["apiKey"])')
for i in 1 2; do   # lần 1 ACCEPTED, lần 2 DUPLICATE
  curl -s -X POST localhost:8091/api/checkin -H "$J" -H "X-Device-Key: $KEY" \
    -d "{\"qrPayload\":\"$QR\",\"idempotencyKey\":\"$(python3 -c 'import uuid;print(uuid.uuid4())')\",\"clientCheckinAt\":\"$(date -u +%FT%TZ)\"}"; echo
done
curl -s localhost:8091/api/checkin/events/$EVENT/stats -H "$A"
```

## Vận hành

### Tác vụ nền

| Tác vụ | Chu kỳ | Việc làm |
|---|---|---|
| `OutboxRelayPublisher` | 2 giây | gửi `outbox_events` chưa relay lên Kafka |
| `ExpireReservationsJob` | 60 giây | hủy reservation quá hạn **không có thanh toán đang chờ**, trả quota và lượt coupon |
| `WaitlistPromotionJob` | 30 giây (`TICKETING_WAITLIST_INTERVAL_MS`) | cấp quota trống cho danh sách chờ, đóng các lời mời đã trả/hết hạn |
| `PaymentReconciliationJob` | 60 giây (`TICKETING_PAYMENT_RECONCILE_MS`), chỉ khi `vnpay` | hỏi VNPay cho payment `PENDING` quá 90 giây hoặc quá hạn; hoàn tiền các khoản `REFUND_REQUIRED` |
| `OutboxCleanupJob` | 1 giờ | xóa dòng outbox đã relay quá `TICKETING_OUTBOX_RETENTION_DAYS` ngày |

### Khóa ký QR (quan trọng nhất)

- Mất hoặc sinh lại khóa ⇒ **mọi QR đã phát thành `INVALID_SIGNATURE`**, không có cách phát lại ngầm. Khóa nằm ở volume `ticketing-platform-keys` (`/app/keys/ticket_signing_key.pem`).
- Sau lần khởi động đầu (đã có file khóa), đặt `TICKETING_QR_REQUIRE_EXISTING_KEY=true` để app **từ chối khởi động** thay vì âm thầm sinh khóa mới khi mất file.
- Backup khóa (có thể dùng container tạm): `docker run --rm -v cms_ticketing-platform-keys:/k -v "$PWD":/b alpine cp /k/ticket_signing_key.pem /b/`. Giữ bản backup như một secret; `**/keys/` đã được `.gitignore`.
- Chưa có rotation (một `kid` cố định). Tương tự với khóa JWT của `user-service` (volume `user-service-keys`), nhưng JWT chỉ sống 15 phút nên hậu quả nhẹ hơn nhiều.

### Kafka: retry, DLT và quan sát

- Consumer lỗi sẽ retry lùi dần (1s→10s, tối đa ~30s) rồi đẩy message sang `<topic>.DLT` (ví dụ `payment-completed.DLT`). Xem bằng Kafka UI (http://localhost:8086).
- Message trong DLT **không tự được xử lý lại**. Cách xử lý: sửa nguyên nhân (DB/mail...), rồi publish lại payload vào topic gốc bằng Kafka UI; các consumer đều idempotent nên xử lý lại an toàn.
- Triệu chứng vé kẹt `RESERVED` sau khi thanh toán `COMPLETED`: kiểm tra `payment-completed.DLT`, rồi log `ticketing-platform`. Nếu không làm gì, `ExpireReservationsJob` sẽ hủy vé khi hết hạn giữ chỗ.
- Outbox: dòng `outbox_events` có `published_at IS NULL` là chưa relay (relay chạy mỗi 2 giây). Số dòng tồn đọng lớn nghĩa là Kafka không nhận được:
  `SELECT count(*) FROM outbox_events WHERE published_at IS NULL;`

### Audit và dữ liệu

- `checkin_records` là audit log append-only: không có đường UPDATE/DELETE trong ứng dụng, không nên xóa tay. Ví dụ truy vết một vé:
  `SELECT outcome, device_id, client_checkin_at, server_received_at, detail FROM checkin_records WHERE ticket_id = '<uuid>' ORDER BY id;`
- Thiết bị nghi ngờ bị lộ key: thu hồi ngay (`PATCH /api/checkin/devices/{id}/revoke`), xem các lần dùng sau đó qua `outcome = 'DEVICE_REVOKED'`, rồi đăng ký thiết bị/key mới.
- Health: `GET /actuator/health` (liveness/readiness, không kèm chi tiết) trên cả hai app. Mặc định chỉ mở `health,info`; `env`, `beans`, `heapdump`... không được mở.
- Truy vết: mọi response có header `X-Correlation-Id` và mọi dòng log có `[id]` — lấy id từ phản hồi lỗi/ảnh chụp của người dùng rồi `docker compose logs ticketing-platform | grep <id>`. Client có thể tự gửi `X-Correlation-Id` (≤64 ký tự `A-Za-z0-9._-`) để nối trace qua nhiều hop.
- Giới hạn tốc độ nằm trong bộ nhớ từng instance; nếu chạy nhiều instance hãy giới hạn ở reverse proxy hoặc dùng kho chung (Redis).
- Bảng `outbox_events`: dòng đã relay được xóa sau `TICKETING_OUTBOX_RETENTION_DAYS` ngày (job mỗi giờ); dòng chưa relay không bao giờ bị xóa.

## Kiểm thử

```bash
cd backend/ticketing-platform
./mvnw test -Dtest='!*IT'                       # unit + context smoke (H2, không cần Docker)
./mvnw test -Dtest='*IT'                        # Docker, Postgres + Kafka thật: CheckinRecordConcurrencyIT, ReservationPaymentFlowIT, VnpayPaymentFlowIT, LifecycleIT
cd ../user-service && ./mvnw test
cd ../../frontend && npm test                    # vitest: xác minh QR trên thiết bị
npm run build                                   # tsc + vite build
```

Test `*IT` cố ý không nằm trong luồng mặc định/CI (cần Docker đáng tin cậy); chạy theo yêu cầu bằng `-Dtest=`.

## CI

`.github/workflows/backend-ci.yml`: matrix `[user-service, ticketing-platform]` chạy `./mvnw -B clean verify`, sau đó job `docker-compose-smoke-test` dựng cả stack và đợi mọi container `healthy`.

## Troubleshooting

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `release version 21 not supported` khi build | chỉ có JRE; cài/đặt `JAVA_HOME` tới JDK 21 |
| `docker compose up --build` báo không thấy jar | chưa chạy `./mvnw package` cho app đó |
| `ticketing-platform` mãi không healthy | cần `user-service`, Postgres và broker healthy trước; xem `docker compose logs ticketing-platform` |
| Vé kẹt ở `RESERVED` sau khi thanh toán | listener Kafka chưa nhận: kiểm tra broker, topic `payment-completed` trong Kafka UI (:8086) và DLT `*.DLT` |
| `docker compose up` báo thiếu `TICKETING_DB_PASSWORD`/`USER_DB_PASSWORD` | chưa có `.env`: `cp .env.example .env` |
| user-service: `Found more than one migration with version 2` | file migration cũ còn trong `target/`; build với `./mvnw clean package` |
| `POST /reservations` hoặc `/payment/requests` trả 401 | thiếu/hết hạn JWT (15 phút): đăng nhập lại — mua vé giờ cần tài khoản |
| `GET /api/ticket/{id}` trả 404 dù vé có thật | vé thuộc tài khoản khác (cố ý trả 404 thay vì 403); ADMIN đọc được mọi vé |
| `POST /reservations` hoặc `/payment/requests` trả 429 | vượt giới hạn IP (xem `Retry-After`) hoặc email đang giữ quá nhiều vé `RESERVED` |
| `forceOutcome is a demo/test hook…` (400) | `TICKETING_PAYMENT_ALLOW_FORCE_OUTCOME=false` (đúng cho môi trường thật) |
| Tạo event trả 401 | JWT hết hạn (15 phút) hoặc thiếu role `ADMIN` |
| Tất cả QR cũ báo `INVALID_SIGNATURE` sau khi chạy lại | khóa ký bị sinh lại (mất volume/file khóa); bật `TICKETING_QR_REQUIRE_EXISTING_KEY=true` sau lần đầu |
| Trình duyệt chặn gọi API (CORS) | origin frontend khác `http://localhost:5173` → đặt `CORS_ALLOWED_ORIGINS` cho cả hai app |
| Quét camera không có nút | trình duyệt không hỗ trợ `BarcodeDetector`; dùng ô dán payload hoặc máy quét phần cứng |
| Đặt chỗ trả `403` "Please verify your email…" | email chưa xác minh; xác minh qua link trong email rồi **làm mới phiên** (frontend tự làm), hoặc `TICKETING_REQUIRE_VERIFIED_EMAIL=false` khi demo |
| Organizer thấy "not allowed" ở trang Manage | role mới chỉ có trong token mới: đăng xuất/đăng nhập lại; hoặc chưa được ADMIN cấp `ORGANIZER` |
| Organizer nhận `404` với sự kiện có thật | sự kiện thuộc tài khoản khác (cố ý trả 404 thay vì 403) |
| Đặt chỗ trả `409` dù còn vé | đang có người trong danh sách chờ vừa với số vé trống — quota thuộc về hàng đợi; hoặc sự kiện chưa `PUBLISHED`/đã kết thúc |
| Chuyển nhượng trả `409` | vé không `ISSUED`, đã đạt `TICKETING_TRANSFER_MAX`, quá sát giờ bắt đầu, hoặc đã quét vào |
| Thanh toán VNPay mãi `PENDING` | IPN không tới được (localhost) — trang `/payment/result` và job đối soát sẽ hỏi lại VNPay; kiểm tra `VNPAY_*`, `docker compose logs ticketing-platform | grep -i vnpay` |
| Không nhận email | chưa cấu hình `MAIL_*` / `MAIL_FROM` chưa được nhà cung cấp xác minh; xem log |
