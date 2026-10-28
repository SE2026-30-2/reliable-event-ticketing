# GateKeep - ticketing-platform API Reference

Base URL `http://localhost:8091`. Swagger UI: `/swagger-ui.html`, OpenAPI: `/api-docs`. Định dạng JSON, thời gian ISO-8601 UTC.

**Xác thực**: 🔓 công khai · 👤 `Authorization: Bearer <JWT>` của **bất kỳ tài khoản** `user-service` (người mua) · 🔑 JWT có `ROLE_ADMIN` **hoặc** `ROLE_ORGANIZER` (ký hiệu 🔑 trong tài liệu này; ORGANIZER chỉ với **sự kiện của mình**, sự kiện khác trả `404`) · 🛡 chỉ `ROLE_ADMIN` (dùng ở hoàn tiền) · 📟 header `X-Device-Key`. Với 👤, JWT chỉ cho biết *ai* gọi; việc *có sở hữu* đặt chỗ/vé đó hay không do server kiểm tra, và "không phải của bạn" luôn trả `404` (không phải `403`) để không dò được id.

**Lỗi** (mọi endpoint): `{ "timestamp", "status", "error", "message" }`.

| Status | Khi nào |
|---|---|
| 400 | validation thất bại (`message` nối các lỗi); mã giảm giá không dùng được (`message` nêu lý do); `forceOutcome` khi chưa bật |
| 401 | thiếu/sai/hết hạn JWT |
| 403 | không đủ role; email chưa xác minh khi đặt chỗ; organizer đòi thiết bị toàn cục |
| 404 | không tồn tại **hoặc không thuộc quyền của bạn** (sự kiện của organizer khác, vé của người khác, sự kiện nháp) |
| 409 | hết vé, sự kiện chưa/không mở bán, chuyển trạng thái vé không hợp lệ, vé không chuyển nhượng được, đã ở danh sách chờ, coupon trùng mã, reservation không còn thanh toán được (đã xử lý/hết hạn) |
| 429 | vượt rate limit theo IP (có `Retry-After`) hoặc tài khoản đang giữ quá nhiều vé `RESERVED` |

Mọi response có header `X-Correlation-Id` (gửi header này lên để dùng id của bạn; ≤64 ký tự `A-Za-z0-9._-`). Header cũng được expose cho CORS cùng `Retry-After`.

## Events (module catalog)

| | Endpoint | Auth |
|---|---|---|
| Tạo event | `POST /api/event` | 🔑 |
| Liệt kê công khai | `GET /api/event?q=` | 🔓 |
| Sự kiện tôi quản lý | `GET /api/manage/events` | 🔑 (ADMIN: tất cả) |
| Chi tiết | `GET /api/event/{eventId}` | 🔓 (nháp/đã hủy: chỉ người quản lý, còn lại `404`) |
| Sửa / xuất bản / hủy | `PATCH /api/event/{eventId}` | 🔑 (đúng chủ) |

`POST /api/event` body: `{ "name": string, "venue"?, "description"?, "bannerUrl"?, "startsAt": instant (tương lai), "endsAt": instant, "status"?: "DRAFT" | "PUBLISHED" (mặc định PUBLISHED) }` → `201`. Người tạo là chủ sự kiện (lấy từ JWT, không từ body); **email chủ không lộ trong response**:

```json
{ "eventId": "uuid", "name": "Rock Night", "venue": "Hanoi Arena", "description": "…", "bannerUrl": null,
  "startsAt": "2030-12-01T18:00:00Z", "endsAt": "2030-12-01T23:00:00Z", "status": "PUBLISHED" }
```

`GET /api/event` chỉ trả sự kiện `PUBLISHED` chưa kết thúc, sớm nhất trước, tối đa 100; `q` lọc không phân biệt hoa thường theo tên/địa điểm (ký tự `%` `_` được thoát). `PATCH` mọi trường tùy chọn (chỉ phần gửi lên đổi); đổi trạng thái hợp lệ: `DRAFT → PUBLISHED | CANCELLED`, `PUBLISHED → CANCELLED`, còn lại `409`.

## Ticket types

| | Endpoint | Auth |
|---|---|---|
| Tạo | `POST /api/event/{eventId}/ticket-types` | 🔑 |
| Liệt kê | `GET /api/event/{eventId}/ticket-types` | 🔓 |

Body: `{ "name", "priceCents": ≥0, "quota": ≥1, "validFrom", "validUntil", "maxEntries"?: 1..50, "bundleSize"?: 1..20 }` — `validFrom/validUntil` là khung check-in, được ký cố định vào QR của mọi vé thuộc loại này; `maxEntries` = số lượt vào mỗi vé (ký vào QR, claim `me`); `bundleSize` = số vé bán chung một đơn vị giá. **`priceCents` đếm theo 1/100 đồng** (VNPay): vé 50.000 ₫ = `5000000`. Chỉ chủ sự kiện/ADMIN tạo được (`404` nếu không). `201`:

```json
{ "ticketTypeId": "uuid", "eventId": "uuid", "name": "GA", "priceCents": 100000,
  "quota": 5, "issuedCount": 0, "remaining": 5, "validFrom": "…", "validUntil": "…",
  "maxEntries": 1, "bundleSize": 1 }
```

`remaining` = quota − đã bán − **đang giữ chỗ** (số thực sự đặt được ngay). Loại vé của sự kiện nháp chỉ người quản lý xem được.

### `GET /api/ticket-types/{ticketTypeId}/quote?quantity=1..10&coupon=CODE` 🔓

Báo giá chỉ đọc (không giữ chỗ): `{ unitPriceCents, ticketCount, grossCents, discountCents, totalCents, couponCode }`. Mã sai/hết hạn/hết lượt/không áp dụng → `400` kèm lý do. Dùng cùng `PriceCalculator` với đặt chỗ nên số hiển thị đúng bằng số bị tính.

## Đặt chỗ và vé

### `POST /api/ticket-types/{ticketTypeId}/reservations` 👤

Body: `{ "quantity": 1..10, "holderName": string, "holderEmail": email, "couponCode"?: string }` → `201`. `quantity` là số **đơn vị** (loại vé bundle cho `quantity × bundleSize` vé). Cần **email đã xác minh** (`403` nếu chưa). Chỉ đặt được cho sự kiện `PUBLISHED` chưa kết thúc (`409`). Khi đang có người trong danh sách chờ vừa với số vé trống, người mua thường nhận `409` (quota thuộc về hàng đợi). Vé được **gắn với tài khoản đang đăng nhập** (`ownerEmail` = `sub` của JWT, chữ thường); mọi `ownerEmail` trong body bị bỏ qua. `holderName`/`holderEmail` chỉ là người dùng vé/nơi nhận email và có thể khác chủ tài khoản (tặng vé). Giới hạn: 10 request/phút/IP và tối đa 10 vé `RESERVED` cùng lúc cho mỗi **tài khoản** — vượt thì `429`:

```json
{ "reservationId": "uuid", "totalCents": 2500000, "discountCents": 2500000,
  "tickets": [ { "ticketId": "uuid", "status": "RESERVED", "reservationId": "uuid",
                 "reservationExpiresAt": "…", "issuedAt": null, "qrPayload": null, "…": "…" } ] }
```

Giữ quota đến `reservationExpiresAt`. `409` nếu vượt phần còn lại.

### `GET /api/ticket/{ticketId}` 👤

Chỉ chủ vé hoặc ADMIN; người khác nhận `404` như vé không tồn tại. Vé tạo trước khi có tài khoản (không có `ownerEmail`) chỉ ADMIN đọc được.

Trả `Ticket`: `ticketId, ticketTypeId, eventId, ownerEmail, holderName, holderEmail, status, statusReason, reservationId, reservationExpiresAt, issuedAt, validFrom, validUntil, qrPayload, source (PURCHASE|GUEST|TRANSFER), maxEntries, transferCount, priceCents`. `qrPayload` chỉ có khi `status = ISSUED`.

`status`: `RESERVED` → `ISSUED` | `CANCELLED`; `ISSUED` → `VOID` | `REFUNDED` | `TRANSFERRED`.

### `POST /api/ticket/{ticketId}/transfer` 👤

Body `{ "toEmail": email, "holderName"?: string }`. Chủ vé chuyển cho tài khoản khác: vé này → `TRANSFERRED` (QR chết ngay tại cổng), người nhận có **vé mới** (id mới, QR mới, email gửi cho họ). Trả `{ oldTicketId, newTicketId, toEmail }` — **không trả QR mới**. `409` nếu vé không `ISSUED`, đã chuyển đủ số lần, quá sát giờ mở, đã quét vào, hoặc người nhận là chính bạn; người khác gọi → `404`. 5 request/phút/IP. Chi tiết cơ chế: [business-flows.md](../business-flows.md#4-thu-hồi-thiết-bị-void-vé-chuyển-nhượng).

### `GET /api/my/tickets` 👤

Vé của chính bạn, **mới nhất trước** (sắp xếp cố định phía server). Phân trang Spring: `?page=0&size=20`, trả `Page<Ticket>`.

### `POST /api/ticket/{ticketId}/resend` 👤

Gửi lại email vé (kèm ảnh QR) tới `holderEmail`. Chỉ chủ vé hoặc ADMIN (người khác `404`); vé không ở `ISSUED` → `409`. Trả `202` (email được gửi bất đồng bộ qua Kafka, topic `ticket-resend-requested`). Giới hạn 5 request/phút/IP.

### `PATCH /api/ticket/{ticketId}/status` 🔑

Body `{ "status": "VOID" | "REFUNDED", "reason": string }` (`TRANSFERRED` không đặt được ở đây — chỉ qua chuyển nhượng). Chỉ hợp lệ từ `ISSUED`, ngược lại `409`; vé của sự kiện không thuộc quyền bạn → `404`. Phát `ticket-voided` (kèm người giữ vé → họ nhận email).

### `GET /api/event/{eventId}/tickets` 🔑

Phân trang Spring (`?page=0&size=20`), trả `Page<Ticket>` **với `qrPayload = null`** (QR là của người giữ vé).

## Danh sách chờ

| | Endpoint | Auth |
|---|---|---|
| Vào hàng đợi | `POST /api/ticket-types/{id}/waitlist` `{quantity 1..10, holderName, holderEmail}` | 👤 (email đã xác minh) |
| Của tôi | `GET /api/my/waitlist` | 👤 |
| Rời / từ chối lời mời | `DELETE /api/waitlist/{entryId}` | 👤 |

Entry: `{ entryId, ticketTypeId, quantity, status: WAITING|OFFERED|CONVERTED|EXPIRED|CANCELLED, reservationId, failureReason, offeredAt, createdAt }`. `409` nếu vé đang còn (hãy đặt chỗ), đã ở trong hàng, hoặc quá 5 hàng đợi. `OFFERED` có `reservationId` — đưa người dùng tới `/checkout/{reservationId}`. 10 request/phút/IP.

## Quản lý (ORGANIZER / ADMIN, đúng chủ sự kiện) — `/api/manage/events/{eventId}/…`

| | Endpoint |
|---|---|
| Tạo / liệt kê coupon | `POST|GET …/coupons` |
| Bật/tắt coupon | `PATCH …/coupons/{couponId}` `{active}` |
| Khách mời | `POST …/guests` |
| Báo cáo | `GET …/report`, `GET …/attendees.csv`, `GET …/payments.csv` |

- **Coupon** body: `{ code (3-40 ký tự A-Z0-9_-), type: PERCENT|FIXED, value (PERCENT 1..100; FIXED = cents/đơn vị vé), ticketTypeId?, maxRedemptions?, validFrom?, validUntil? }`. `409` nếu trùng mã trong sự kiện. Lượt dùng tính **mỗi reservation** và trả lại khi reservation bị hủy.
- **Khách mời** body: `{ ticketTypeId, guests: [{ name, email }] (1..200) }` → `201` danh sách vé (**không kèm QR**). Tất cả hoặc không (quota không đủ → `409`). Cho cả sự kiện nháp, không cho sự kiện đã hủy/kết thúc.
- **Báo cáo** `…/report`: `{ eventId, name, generatedAt, ticketTypes: [{ ticketTypeId, name, priceCents, quota, issued, reserved, remaining, refunded, voided, guests, checkedIn, revenueCents }], totals: { ticketsIssued, guestTickets, refunded, voided, checkedIn, noShow, collectedCents, refundedCents, netRevenueCents, couponDiscountCents } }`. CSV: `text/csv; charset=UTF-8`, có BOM, ô bắt đầu bằng `= + - @` được thêm `'`.
- `GET /api/manage/events` liệt kê sự kiện bạn quản lý (ở mục Events).

## Thanh toán (module payment: mock hoặc VNPay)

### `POST /api/payment/requests` 👤

Body: `{ "reservationId": uuid, "forceOutcome"?: "COMPLETED" | "FAILED" }`. **Không có số tiền**: server tính = tổng giá (đã chốt lúc đặt chỗ, sau coupon) của các vé còn `RESERVED`, và trả lại trong `amountCents`; trường lạ như `amountCents` trong body bị bỏ qua. Chỉ **chủ reservation** gọi được — cả khi gọi lại để lấy kết quả cũ; người khác nhận `404`. Reservation không tồn tại → `404`; đã `ISSUED`/`CANCELLED` hoặc đã hết hạn (kể cả khi job quét chưa chạy) → `409`. `201`:

```json
{ "paymentRequestId": "uuid", "reservationId": "uuid", "amountCents": 2500000, "status": "COMPLETED",
  "createdAt": "…", "completedAt": "…", "provider": "MOCK", "txnRef": null, "paymentUrl": null, "failureReason": null }
```

- `status`: `PENDING`, `COMPLETED`, `FAILED`, `REFUND_REQUIRED`, `REFUNDED`. `provider`: `MOCK`, `VNPAY` hoặc `FREE` (đơn 0 đồng, hoàn tất ngay không qua cổng).
- **Idempotent theo `reservationId`**: gọi lại trả kết quả cũ, không tính tiền lần hai.
- Phản hồi chỉ để UI hiển thị; vé chuyển `ISSUED`/`CANCELLED` sau khi event `payment-completed/failed` được catalog xử lý (bất đồng bộ, thường < 1–2 giây) — hãy poll `GET /api/ticket/{id}`.
- **Chế độ `mock`**: kết quả có ngay trong response. `forceOutcome` chỉ dùng được khi `ticketing.payment.allow-force-outcome=true` (demo), ngược lại `400`; bỏ trống thì theo tỉ lệ `ticketing.payment.success-rate`.
- **Chế độ `vnpay`**: trả `status: "PENDING"`, `provider: "VNPAY"`, `txnRef` và `paymentUrl` (link trang thanh toán VNPay, đã ký, hết hạn cùng reservation) — frontend chuyển hướng người mua tới đó. Gọi lại khi payment còn mở trả **cùng một** link; `forceOutcome` bị `400`.
- Rate limit 20 request/phút/IP.

### `GET /api/payment/requests/by-reservation/{reservationId}` 👤
Trạng thái payment của một reservation (chỉ chủ reservation; người khác `404`). Chỉ khi bật VNPay, ngược lại `404`.

### `POST /api/payment/vnpay/sync/{txnRef}` 👤
Người mua vừa quay về từ VNPay: server **hỏi lại VNPay** (`querydr`, có chữ ký) và giải quyết payment ngay (IPN có thể chậm/không tới được). Trả `PaymentRequest` hiện tại; VNPay không với tới được thì vẫn trả `PENDING`. Chỉ chủ payment.

### `GET /api/payment/vnpay/ipn` 🔓
Callback server→server của VNPay (**công khai vì VNPay không có JWT — xác thực bằng chữ ký HMAC-SHA512**). Trả luôn HTTP 200 với `{"RspCode","Message"}`: `00` thành công, `01` không có đơn, `02` đã xử lý (gửi lặp), `04` sai số tiền, `97` sai chữ ký. Thành công chỉ khi cả `vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`. URL này phải là địa chỉ HTTPS công khai, đăng ký trong cổng merchant của VNPay.

### `POST /api/payment/requests/{paymentRequestId}/refund` 🛡
Chỉ ADMIN. Hoàn tiền toàn phần một payment VNPay `COMPLETED`: gọi API refund, payment → `REFUNDED`, event `payment-refunded` làm vé `REFUNDED`. Payment khác trạng thái/nhà cung cấp, hoặc VNPay từ chối → `409`.

## Thiết bị check-in (module checkin)

### `POST /api/checkin/devices` 🔑

Body `{ "label": string, "eventId"?: uuid|null }` → `201`. ORGANIZER **bắt buộc** `eventId` của sự kiện mình (thiếu → `403`, sự kiện của người khác → `404`); chỉ ADMIN được tạo thiết bị dùng cho mọi sự kiện:

```json
{ "deviceId": "uuid", "label": "Gate A", "eventId": null, "apiKey": "…" }
```

`apiKey` chỉ xuất hiện **một lần**; server chỉ lưu SHA-256. Nếu có `eventId`, thiết bị chỉ được check-in vé của sự kiện đó (vé sự kiện khác trả `WRONG_EVENT`).

### `GET /api/checkin/devices?eventId=` 🔑

Thiết bị của một sự kiện (`[{ deviceId, label, eventId, status, createdAt, revokedAt, lastSeenAt }]`; không bao giờ có key). Bỏ `eventId` = tất cả thiết bị — chỉ ADMIN (`403` cho organizer).

### `PATCH /api/checkin/devices/{deviceId}/revoke` 🔑

Thu hồi vĩnh viễn. Trả `{ deviceId, label, eventId, status, createdAt, revokedAt, lastSeenAt }`; `404` nếu không tồn tại **hoặc không thuộc sự kiện bạn quản lý** (thiết bị toàn cục: chỉ ADMIN).

## Check-in

Xác thực bằng 📟 `X-Device-Key`. Endpoint **luôn trả 200 với outcome có cấu trúc** cho mọi kết quả nghiệp vụ (kể cả key sai/bị thu hồi) — không dùng 401/409 cho các trường hợp này.

### `POST /api/checkin`

Body: `{ "qrPayload": string, "idempotencyKey": uuid, "clientCheckinAt": instant }` (cả ba bắt buộc). Phản hồi:

```json
{ "ticketId": "uuid|null", "outcome": "ACCEPTED", "detail": "First accepted scan", "serverReceivedAt": "…", "entryNo": 1 }
```

- `idempotencyKey` do client sinh cho **mỗi lần quét**; gửi lại cùng key trả lại đúng bản ghi cũ.
- `ticketId` lấy từ claims đã xác minh chữ ký (không nhận ticketId do client gửi); `null` khi payload không hợp lệ.

### `POST /api/checkin/batch`

Body: mảng `SubmitCheckinRequest` (1..500 phần tử). Trả mảng kết quả **cùng thứ tự**, mỗi phần tử độc lập (một phần tử lỗi nghiệp vụ không ảnh hưởng phần tử khác). Dùng để xả hàng đợi offline.

### Outcome

| Outcome | Ý nghĩa |
|---|---|
| `ACCEPTED` | lần quét hợp lệ (lượt `entryNo` của vé; vé dùng một lần chỉ có lượt 1) |
| `DUPLICATE` | vé đã dùng hết số lượt vào (`maxEntries`) |
| `INVALID_SIGNATURE` | chữ ký sai / payload không giải mã được |
| `WRONG_EVENT` | thiết bị được đăng ký cho một sự kiện khác với sự kiện của vé |
| `EXPIRED_WINDOW` | thời điểm server nhận nằm ngoài `validFrom..validUntil` của vé |
| `TICKET_VOIDED` | vé bị void/refund/**chuyển nhượng** (kể cả bị void ngay giữa lúc kiểm tra và ghi) |
| `DEVICE_NOT_FOUND` | thiếu/không khớp `X-Device-Key` |
| `DEVICE_REVOKED` | thiết bị đã bị thu hồi |

Thứ tự ưu tiên kiểm tra: xem [architecture.md](../architecture.md#check-in-chống-dùng-lại-vé-offline).

### `GET /api/checkin/events/{eventId}/stats` 🔑

```json
{ "eventId": "uuid", "totalIssued": 1, "acceptedCount": 1, "duplicateCount": 1,
  "deviceRejectedCount": 0, "invalidCount": 0 }
```

`totalIssued` = số vé hiện còn hợp lệ (`ISSUED`); `acceptedCount` = số **lượt** vào được chấp nhận (vé nhiều lượt vào đóng góp nhiều lần). `deviceRejectedCount` = `DEVICE_NOT_FOUND + DEVICE_REVOKED`; `invalidCount` = `INVALID_SIGNATURE + WRONG_EVENT + EXPIRED_WINDOW + TICKET_VOIDED`. Chỉ tính các bản ghi có `event_id` (lần quét giải mã được QR). Chỉ đúng chủ sự kiện/ADMIN (`404` nếu không).

### `GET /api/checkin/events/{eventId}/timeline?bucketMinutes=15` 🔑

`[{ bucketStart, accepted, duplicate, rejected }]` theo thời gian, cũ trước, bỏ qua khung không có lần quét; `bucketMinutes` 1..1440. Tính theo lúc quét tại cổng (giờ thiết bị, bị chặn không muộn hơn lúc server nhận) — xem [business-flows.md](../business-flows.md#5-dashboard-và-timeline).

## Khóa công khai

### `GET /.well-known/jwks.json` 🔓

JWK Set chứa public key RS256 dùng ký QR (`kid = ticket-service-key-1`). Check-in app tải và cache để tự xác minh chữ ký **offline** trên thiết bị (server luôn xác minh lại khi nhận). Dạng JWK Set chuẩn, `kid` khớp tiền tố của QR; app tải lại khi gặp `kid` lạ. Đây là khóa của `catalog`, độc lập với JWKS của `user-service`.

## Kafka (nội bộ)

Xem bảng topic trong [architecture.md](../architecture.md#giao-tiếp-giữa-các-module-kafka--outbox). Payload là JSON; các trường chính:

| Topic | Trường |
|---|---|
| `ticket-reserved` | `eventId, ticketId, reservationId, eventIdFk, ticketTypeId, reservationExpiresAt, reservedAt` |
| `ticket-issued` | `eventId, ticketId, eventIdFk, ticketTypeId, holderName, holderEmail, qrPayload, validFrom, validUntil, issuedAt` |
| `ticket-voided` | `eventId, ticketId, eventIdFk, status (VOID/REFUNDED/TRANSFERRED), reason, changedAt, holderName, holderEmail` |
| `ticket-resend-requested` | cùng trường với `ticket-issued` (consumer: notification, gửi lại email vé) |
| `payment-completed` | `eventId, paymentRequestId, reservationId` |
| `payment-failed` | `eventId, paymentRequestId, reservationId, reason` |
| `payment-refunded` | `eventId, paymentRequestId, reservationId` (consumer: catalog, vé `ISSUED → REFUNDED`) |
| `waitlist-offered` | `eventId, entryId, holderName, holderEmail, reservationId, eventName, ticketCount, expiresAt` (consumer: notification, email link thanh toán) |

(`eventId` ở đây là id của *message* outbox, còn `eventIdFk` là id của sự kiện (event) mà vé thuộc về.)
