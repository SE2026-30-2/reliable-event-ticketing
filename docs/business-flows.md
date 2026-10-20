# GateKeep - Luồng nghiệp vụ

Tài liệu mô tả từng luồng từ góc nhìn người dùng và quy tắc nghiệp vụ. Các luồng này đã được chạy thật trên stack Docker (API và giao diện trình duyệt). Cơ chế kỹ thuật: [architecture.md](architecture.md); endpoint chi tiết: [api/ticketing-platform.md](api/ticketing-platform.md).

## Mục lục

1. [Chuẩn bị sự kiện](#1-chuẩn-bị-sự-kiện-organizer-hoặc-admin)
2. [Mua vé](#2-mua-vé)
3. [Check-in](#3-check-in)
4. [Thu hồi thiết bị, void vé, chuyển nhượng](#4-thu-hồi-thiết-bị-void-vé-chuyển-nhượng)
5. [Dashboard và timeline](#5-dashboard-và-timeline)
6. [Danh sách chờ](#6-danh-sách-chờ)
7. [Khách mời](#7-khách-mời-vé-miễn-phí)
8. [Báo cáo cho nhà tổ chức](#8-báo-cáo-cho-nhà-tổ-chức)

## Actor

| Actor | Làm gì | Xác thực |
|---|---|---|
| Quản trị nền tảng (`ADMIN`) | mọi thao tác trên **mọi** sự kiện; cấp/thu role `ORGANIZER`; hoàn tiền VNPay | JWT từ `user-service` |
| Nhà tổ chức (`ORGANIZER`) | tạo và quản lý **sự kiện của mình**: loại vé, coupon, khách mời, thiết bị, dashboard, báo cáo; không thấy dữ liệu của tổ chức khác | JWT (role `ORGANIZER`) |
| Người mua | xem/tìm sự kiện (công khai); đặt chỗ (cần email đã xác minh), thanh toán, xem/gửi lại/chuyển nhượng vé, vào danh sách chờ | tài khoản `user-service` (JWT) |
| Nhân viên check-in | quét QR bằng thiết bị đã đăng ký | `X-Device-Key` |

## 1. Chuẩn bị sự kiện (ORGANIZER hoặc ADMIN)

1. ADMIN cấp role: `PATCH /api/user/admin/users/{id}/roles` với `["USER","ORGANIZER"]` (hoặc trang **Users** trong frontend). Người đó đăng nhập lại (hoặc làm mới phiên) để JWT mang role mới.
2. `POST /api/event`. Người tạo trở thành **chủ sự kiện** (`organizer_id`). `startsAt` phải ở tương lai.
   - `status: "DRAFT"` giữ sự kiện ẩn: công chúng nhận 404, chỉ chủ và ADMIN thấy. Xuất bản bằng `PATCH /api/event/{id}` `{"status":"PUBLISHED"}`.
   - `PUBLISHED → CANCELLED` dừng bán; không quay lại `DRAFT`. Sự kiện `CANCELLED` hoặc đã kết thúc không đặt chỗ được.
   - Hủy sự kiện **chỉ dừng bán**; vé đã phát hành và các khoản thanh toán vẫn xử lý riêng (void/hoàn tiền từng vé hoặc thanh toán).
3. `POST /api/event/{eventId}/ticket-types`: `quota ≥ 1`; `validFrom/validUntil` là khung check-in được ký vào QR. Tùy chọn `maxEntries` (vé nhiều lượt vào, ví dụ vé 2 ngày = 2) và `bundleSize` (gói nhiều vé một giá, ví dụ nhóm 4 người). Muốn bán theo khung giờ (sáng/chiều) thì tạo nhiều loại vé có khung hiệu lực khác nhau.
4. `POST /api/checkin/devices`: trả `apiKey` **một lần duy nhất**. Organizer bắt buộc gắn thiết bị với **một sự kiện của mình**; chỉ ADMIN được tạo thiết bị dùng cho mọi sự kiện.
5. Tùy chọn: coupon (`/api/manage/events/{id}/coupons`) và khách mời (`/guests`).

**Cô lập dữ liệu**: mọi endpoint quản lý đều hỏi "caller có quản lý sự kiện này không" (`EventAccessPort`). Sự kiện của người khác **trả 404 giống hệt "không tồn tại"**, nên không dò được id.

## 2. Mua vé

```text
Người mua (đã đăng nhập, email đã xác minh)
   ─ chọn loại vé, số lượng, người dùng vé, mã giảm giá ─► POST /reservations      (vé gắn với tài khoản)
   ◄─ reservationId, totalCents, vé RESERVED (chưa có QR), giữ chỗ ~10 phút
   ─ POST /api/payment/requests {reservationId} ─►                                  (server tự tính số tiền)
   ◄─ mock: COMPLETED | FAILED (đồng bộ)      vnpay: PENDING + paymentUrl
 (bất đồng bộ)
   payment-completed → catalog phát hành vé: ký QR, ISSUED, gửi email kèm ảnh QR
   payment-failed    → vé CANCELLED, trả quota và lượt dùng coupon
   không thanh toán  → hết hạn, ExpireReservationsJob hủy và trả quota
```

Quy tắc:

- **Email phải được xác minh** (claim `email_verified` trong JWT) mới đặt chỗ hoặc vào danh sách chờ được; chưa xác minh → `403`. Tắt bằng `TICKETING_REQUIRE_VERIFIED_EMAIL=false` (chỉ để demo khi chưa có SMTP).
- **Điều kiện mở bán**: sự kiện `PUBLISHED` và chưa kết thúc.
- **Báo giá**: `GET /api/ticket-types/{id}/quote?quantity&coupon` cho biết trước tổng tiền (cùng bộ tính giá với đặt chỗ nên số hiển thị đúng bằng số bị tính). Mã sai/hết hạn/hết lượt/không áp dụng → `400` kèm lý do.
- **Giá được chốt lúc đặt chỗ** (`tickets.price_cents`). Tổng phải trả = tổng giá các vé còn `RESERVED`; đổi giá hoặc coupon sau đó không ảnh hưởng đơn đang giữ.
- **Coupon**: giảm theo phần trăm hoặc số tiền cố định mỗi đơn vị vé, có thể giới hạn theo loại vé, số lượt, thời hạn. Mỗi reservation tiêu **một** lượt, trả lại nếu reservation bị hủy hoặc hết hạn.
- **Gói (bundle)**: một "đơn vị" = `bundleSize` vé bán chung một giá. Quota đếm theo vé; giá chia đều cho các vé của gói (phần dư dồn cho các vé đầu) nên tổng luôn khớp tới từng đồng.
- **Đơn 0 đồng** (coupon 100%): hoàn tất ngay không qua cổng thanh toán (`provider = FREE`), vẫn phát `payment-completed` để việc phát hành vé chỉ có một điểm kích hoạt.
- **Giới hạn**: tối đa 10 vé `RESERVED` cùng lúc mỗi tài khoản và 10 lần đặt chỗ/phút mỗi IP — vượt thì `429`.
- **Hết vé**: đặt chỗ vượt phần còn lại (`quota − issued − reserved`) trả `409`; khi đó người mua có thể vào [danh sách chờ](#6-danh-sách-chờ). Nếu đang có người chờ *vừa với* số vé trống, đặt chỗ thường cũng bị `409` (quota thuộc về hàng đợi).
- **Thanh toán lặp lại** cho cùng reservation không tính tiền lần hai — trả lại kết quả cũ. Chỉ chủ reservation thanh toán được; reservation hết hạn/đã xử lý → `409`.
- Trang `/checkout/:id` poll `GET /api/ticket/{id}` tối đa ~15 giây đến khi `ISSUED`, vì việc phát hành là bất đồng bộ qua Kafka.

### Thanh toán qua VNPay (`TICKETING_PAYMENT_PROVIDER=vnpay`)

Vé chỉ được phát hành khi **VNPay xác nhận có chữ ký**; trình duyệt không bao giờ là nguồn sự thật.

```text
POST /api/payment/requests ─► PENDING + paymentUrl (HMAC-SHA512, hết hạn cùng reservation) ─► frontend chuyển sang VNPay
Người mua trả tiền tại VNPay. Kết quả đến từ ba nguồn, ai đến trước thắng:
   ├─ IPN  GET /api/payment/vnpay/ipn          (VNPay → server, kiểm chữ ký và số tiền)
   ├─ Người mua quay về /payment/result → POST /api/payment/vnpay/sync/{txnRef}
   │       (server hỏi lại VNPay bằng querydr; không tin query string của trình duyệt)
   └─ PaymentReconciliationJob (60s) hỏi VNPay cho payment PENDING quá 90s hoặc quá hạn
        COMPLETED → payment-completed → vé ISSUED          FAILED → payment-failed → vé CANCELLED
```

- IPN bị VNPay gửi lặp là bình thường; `settle` chỉ chuyển payment đang `PENDING` nên các lần sau là no-op.
- Job hết hạn **không hủy** reservation đang có payment `PENDING` — tránh cảnh khách đã trả mà vé bị hủy. Payment tự được giải quyết rồi quota mới được trả.
- **Trả tiền nhưng reservation đã bị hủy**: payment sang `REFUND_REQUIRED`, job đối soát gọi API hoàn tiền → `REFUNDED`.
- **Hoàn tiền (ADMIN)** `POST /api/payment/requests/{id}/refund`: VNPay hoàn tiền → `REFUNDED` + `payment-refunded` → vé `ISSUED → REFUNDED` và phát `ticket-voided` (cổng từ chối vé đó). Quota không được trả lại.
- **Đơn vị tiền**: giá lưu theo 1/100 đồng (`priceCents`), trùng `vnp_Amount` của VNPay — không quy đổi. Vé 50.000 ₫ = `5000000`.

## 3. Check-in

Có mạng:

```text
Thiết bị quét QR ─► (lưu IndexedDB) ─► POST /api/checkin/batch ─► ACCEPTED | DUPLICATE | …
```

Mất mạng: thiết bị **tự xác minh chữ ký và khung hợp lệ** (kết quả tạm thời hiện ngay: hợp lệ / giả / hết hạn / đã quét trên máy này) và **xếp hàng** lần quét; khi có mạng, flush theo batch. Hai thiết bị cùng offline quét cùng một vé → khi đồng bộ, bản ghi commit trước là `ACCEPTED`, bản còn lại `DUPLICATE` (kể cả khi thiết bị "đến sau" khai timestamp sớm hơn).

| Outcome | Ý nghĩa | Hành động gợi ý cho nhân viên |
|---|---|---|
| `ACCEPTED` | lần quét hợp lệ (lượt `entryNo` của vé) | cho vào |
| `DUPLICATE` | vé đã dùng hết số lượt vào | từ chối, nghi vấn sao chép QR |
| `INVALID_SIGNATURE` | QR không do hệ thống ký / hỏng | từ chối |
| `WRONG_EVENT` | thiết bị này được gán cho sự kiện khác | chuyển sang cổng đúng sự kiện |
| `EXPIRED_WINDOW` | ngoài khung `validFrom..validUntil` | từ chối |
| `TICKET_VOIDED` | vé bị void/hoàn tiền/chuyển nhượng sau khi phát hành | từ chối |
| `DEVICE_NOT_FOUND` / `DEVICE_REVOKED` | key thiết bị sai / bị thu hồi | báo quản trị |

Mọi outcome đều được ghi vào `checkin_records` — đó chính là audit log.

**Vé nhiều lượt vào** (`maxEntries > 1`, claim `me` ký trong QR): mỗi lần quét hợp lệ là một "lượt" đánh số 1..N (`checkin_records.entry_no`); lượt N+1 là `DUPLICATE` ("all N entries used"). Việc đếm và ghi là một bước nguyên tử theo từng vé nên 10 thiết bị quét đồng thời vẫn chỉ vào đúng N lượt. Thiết bị cũng đếm số lần quét ngay trên máy để cảnh báo sớm.

**Máy quét phần cứng** (USB/Bluetooth giả lập bàn phím): bật *Hardware scanner mode* ở trang `/checkin`. Ô nhập luôn giữ focus; máy quét gõ mã rồi nhấn Enter. Kết quả mới nhất hiện cỡ lớn (ENTRY OK / DUPLICATE / ...).

## 4. Thu hồi thiết bị, void vé, chuyển nhượng

- **Mất thiết bị**: `PATCH /api/checkin/devices/{id}/revoke` (ADMIN, hoặc organizer của sự kiện đó). Mọi lần gửi từ key đó — kể cả hàng đợi offline còn tồn — bị `DEVICE_REVOKED` và được ghi lại. `GET /api/checkin/devices?eventId=` liệt kê thiết bị của sự kiện.
- **Vé gian lận/hoàn tiền**: `PATCH /api/ticket/{id}/status` với `VOID` hoặc `REFUNDED` (chỉ từ `ISSUED`; organizer chỉ với vé của sự kiện mình). Phát `ticket-voided` → `checkin` cập nhật cache → lần quét sau là `TICKET_VOIDED`; **người giữ vé nhận email** báo vé đã thay đổi.
- **Chuyển nhượng** `POST /api/ticket/{id}/transfer {toEmail, holderName?}` (chủ vé): vé cũ → `TRANSFERRED` (QR chết ngay tại cổng) và người nhận có **vé mới** (id mới, QR mới, được gửi email).
  - Vì sao không chỉ đổi chủ: QR không chứa chủ sở hữu, nên bản chụp màn hình của người cũ vẫn hợp lệ và sẽ tranh vào cùng người mới.
  - Điều kiện: vé `ISSUED`; tối đa `ticketing.transfer.max-per-ticket` lần (mặc định 2, `0` = tắt); đóng trước giờ bắt đầu `cutoff-minutes-before-start` phút (mặc định 60); người nhận khác người gửi.
  - **Không chuyển được nếu vé đã quét vào.** Kiểm tra dùng cùng khóa với check-in, nên nếu một lần quét và một lần chuyển diễn ra cùng lúc thì hoặc quét đến trước (chuyển bị từ chối) hoặc chuyển đến trước (lần quét bị `TICKET_VOIDED`) — không bao giờ cả hai cùng thành công.
  - Quota không đổi. Vé mới giữ `reservation_id` của vé gốc, nên hoàn tiền sau này vẫn vô hiệu đúng vé đang sống.

## 5. Dashboard và timeline

- `GET /api/checkin/events/{eventId}/stats`: `totalIssued`, `acceptedCount`, `duplicateCount`, `deviceRejectedCount` (thiết bị không rõ/bị thu hồi), `invalidCount` (chữ ký/hết hạn/void/sai sự kiện).
- `GET …/timeline?bucketMinutes=15`: số lần vào/trùng/từ chối theo khung giờ, tính theo **lúc quét tại cổng** (`client_checkin_at`, bị chặn không vượt `server_received_at`), không phải lúc đồng bộ — thiết bị offline một giờ rồi đồng bộ không tạo ra một cột đột biến. Giờ của thiết bị chỉ ảnh hưởng biểu đồ, không bao giờ quyết định ai được vào.
- Tab **Check-in live** trong console tự làm mới mỗi 5 giây.

## 6. Danh sách chờ

Khi loại vé hết (hoặc không đủ cho số lượng muốn mua), người mua `POST /api/ticket-types/{id}/waitlist`.

- Khi quota trống ra (hết hạn giữ chỗ, thanh toán thất bại, ai đó từ chối lời mời), `WaitlistPromotionJob` (30 giây/lần) duyệt hàng đợi theo thứ tự vào và **cấp một reservation thật** — giữ chỗ có thời hạn như mua bình thường — cho người đầu tiên *vừa với* số vé trống (người cần nhiều hơn số trống giữ nguyên vị trí), rồi gửi email kèm link thanh toán.
- Hết hạn mà không trả → quota nhả lại và người kế tiếp được mời. Trạng thái: `WAITING → OFFERED → CONVERTED` (đã trả) hoặc `EXPIRED` (lỡ); `CANCELLED` khi tự rời.
- **Chống chen ngang**: khi có người đang chờ *vừa với* số vé trống, người mua thường bị từ chối (`409`) — quota vừa nhả thuộc về người đã xếp hàng.
- Mỗi tài khoản một chỗ cho mỗi loại vé và tối đa 5 hàng đợi. Từ chối lời mời (`DELETE /api/waitlist/{id}`) nhả ngay vé đang giữ cho người kế tiếp.

## 7. Khách mời (vé miễn phí)

`POST /api/manage/events/{id}/guests {ticketTypeId, guests:[{name,email}]}` (tối đa 200): phát thẳng vé `ISSUED` miễn phí (`source = GUEST`, giá 0), trừ vào quota, ký QR và gửi email; vé thuộc tài khoản có email đó.

- **Tất cả hoặc không**: quota không đủ cho cả danh sách thì không phát vé nào.
- Cho phép cả sự kiện nháp; không cho sự kiện đã hủy hoặc đã kết thúc.
- Không tính vào doanh thu; thu hồi bằng `PATCH …/status` như vé thường.
- Danh sách do organizer nhập nên response **không trả QR** của khách.

## 8. Báo cáo cho nhà tổ chức

- `GET /api/manage/events/{id}/report`: theo từng loại vé (quota, đã phát, đang giữ, còn lại, hoàn, void, khách mời, đã vào, doanh thu) và tổng (doanh thu thuần, đã hoàn, tổng giảm giá từ coupon, vé hợp lệ, đã vào, chưa vào). Tiền lấy từ **số tiền các payment thực sự thu/hoàn**, không tính lại từ giá.
- `GET …/attendees.csv` (mỗi vé: loại, người dùng, trạng thái, nguồn, số lượt đã vào, lần vào đầu) và `GET …/payments.csv` (mỗi giao dịch). CSV theo RFC 4180, có BOM UTF-8 (Excel đọc đúng tiếng Việt) và **chống formula injection**: tên/email do người mua nhập, nên ô bắt đầu bằng `= + - @` được thêm dấu `'` để Excel/Sheets không thực thi thành công thức.
