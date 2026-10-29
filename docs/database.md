# GateKeep - Cơ sở dữ liệu

Hai database PostgreSQL 16 riêng biệt, schema do Flyway quản lý; Hibernate không tự tạo hay sửa schema. Khóa nội bộ `id BIGSERIAL` + khóa nghiệp vụ `UUID` (cột `*_id`) dùng xuyên suốt.

| Database | Chủ sở hữu | Host port (local) |
|---|---|---|
| `ticketing_platform` | `ticketing-platform` | 5437 |
| `user_service` | `user-service` (xem [api/user-service.md](api/user-service.md)) | 5436 |

## ticketing_platform

Một chuỗi migration duy nhất `backend/ticketing-platform/src/main/resources/db/migration/`:

| Migration | Nội dung |
|---|---|
| `V1__init.sql` | `events`, `ticket_types`, `tickets` |
| `V2__add_outbox_infrastructure.sql` | `outbox_events` (dùng chung mọi module) |
| `V3__add_payment.sql` | `payment_requests` |
| `V4__add_checkin.sql` | `checkin_devices`, `checkin_records`, `voided_tickets` |
| `V5__add_ticket_owner.sql` | `tickets.owner_email` + index `idx_tickets_owner (owner_email, created_at DESC)` |
| `V6__payment_providers.sql` | `payment_requests`: `provider`, `txn_ref` (UNIQUE), `provider_txn_no`, `provider_created_at`, `provider_paid_at`, `pay_expires_at`, `failure_reason`, `refunded_at` |
| `V7__organizers_and_event_details.sql` | `events.organizer_id`, `description`, `banner_url` (+ index theo organizer và `(status, ends_at)` cho danh sách công khai); `checkin_devices.created_by` |
| `V8__ticket_lifecycle.sql` | `tickets.source/transferred_from/transfer_count/max_entries`, `ticket_types.max_entries`, `checkin_records.entry_no`; **thay** unique index chống dùng lại bằng `(ticket_id, entry_no)` |
| `V9__pricing_coupons_bundles.sql` | `tickets.price_cents/coupon_id`, `ticket_types.bundle_size`, bảng `coupons`; `payment_requests.amount_cents` cho phép `0` (đơn miễn phí) |
| `V10__waitlist.sql` | bảng `waitlist_entries` |

### events

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `event_id` | UUID UNIQUE | khóa nghiệp vụ |
| `name`, `venue` | VARCHAR | |
| `organizer_id` | VARCHAR(255) | tài khoản chủ sự kiện (`sub` của JWT, chữ thường); `NULL` = dữ liệu trước khi có organizer, chỉ ADMIN quản lý |
| `description`, `banner_url` | TEXT / VARCHAR(500) | |
| `starts_at`, `ends_at` | TIMESTAMPTZ | |
| `status` | VARCHAR(20) | `DRAFT/PUBLISHED/CANCELLED/COMPLETED`. Công chúng chỉ thấy `PUBLISHED` chưa kết thúc; chỉ `PUBLISHED` mới bán được |

### ticket_types

| Cột | Ghi chú |
|---|---|
| `ticket_type_id` UUID UNIQUE, `event_id` → `events.event_id` | |
| `name`, `price_cents` | |
| `quota` | tổng số vé; `CHECK (quota >= 0)` |
| `issued_count` | số vé đã `ISSUED` |
| `reserved_count` | số vé đang `RESERVED`; `CHECK (reserved_count >= 0)` |
| `valid_from`, `valid_until` | khung check-in, **sao chép lên từng vé** và được ký cố định trong QR |
| `max_entries` | số lượt vào cho mỗi vé (1..50), sao chép lên vé, ký vào QR (claim `me`, bỏ khi = 1 để QR gọn) |
| `bundle_size` | số vé bán chung một đơn vị giá (1..20); quota đếm theo vé |

Ràng buộc: `CHECK (issued_count + reserved_count <= quota)`. Quota được bảo vệ bằng khóa dòng (`PESSIMISTIC_WRITE`) khi đặt chỗ/confirm/cancel.

### tickets

| Cột | Ghi chú |
|---|---|
| `ticket_id` UUID UNIQUE, `ticket_type_id`, `event_id` | |
| `owner_email` | tài khoản người mua (`sub` của JWT, chữ thường) — ai được xem/gửi lại/thanh toán; `NULL` = vé trước khi có tài khoản (chỉ ADMIN đọc) |
| `holder_name`, `holder_email` | người dùng vé và nơi gửi email; có thể khác chủ tài khoản |
| `status` | `RESERVED` (mặc định) / `ISSUED` / `CANCELLED` / `VOID` / `REFUNDED` / `TRANSFERRED` |
| `price_cents` | giá vé đã bán (sau coupon); tổng thanh toán = tổng các vé `RESERVED` của reservation |
| `coupon_id` | coupon của reservation (mỗi reservation tiêu 1 lượt) |
| `source` | `PURCHASE` / `GUEST` (khách mời) / `TRANSFER`; doanh thu chỉ tính `PURCHASE` |
| `transferred_from`, `transfer_count` | vé đã thay thế và số lần chuyển nhượng trong chuỗi |
| `max_entries` | số lượt vào của vé này |
| `status_reason` | lý do hủy/void ("payment failed: …", "reservation expired", …) |
| `reservation_id` | gom các vé tạo từ một lần đặt chỗ; index `idx_tickets_reservation` |
| `reservation_expires_at` | hạn giữ chỗ (cấu hình `ticketing.reservation.expiry-minutes`, mặc định 10) |
| `issued_at` | `NULL` đến khi `ISSUED` |
| `qr_payload` | `NULL` đến khi `ISSUED`; chuỗi đã ký, lưu nguyên văn để render lại |

### payment_requests

`payment_request_id` UUID UNIQUE · `reservation_id` UUID **UNIQUE** (một lần thanh toán cho mỗi reservation — chốt chặn DB cho tính idempotent) · `amount_cents` (`>= 0`; `0` = đơn miễn phí do coupon 100%) · `status` (`PENDING/COMPLETED/FAILED/REFUND_REQUIRED/REFUNDED`) · `created_at`, `completed_at`, `refunded_at`.

Từ V6: `provider` (`MOCK`/`VNPAY`) · `txn_ref` = mã đơn gửi VNPay (`vnp_TxnRef`, UNIQUE khi có) · `provider_created_at` giữ **nguyên văn** `yyyyMMddHHmmss` (GMT+7) vì API `querydr`/`refund` của VNPay đòi đúng giá trị gốc · `pay_expires_at` (= hạn giữ chỗ) · `failure_reason`. Partial index `idx_payment_requests_pending` phục vụ job đối soát và job hết hạn.

### outbox_events

`event_id` UUID UNIQUE · `aggregate_id` (luôn là id của vé/payment, để giữ thứ tự theo khóa Kafka) · `event_type` · `topic` · `payload` TEXT (JSON) · `created_at` · `published_at` (`NULL` = chưa relay). Partial index `idx_outbox_events_unpublished ON (id) WHERE published_at IS NULL`.

### checkin_devices

`device_id` UUID UNIQUE · `label` · `event_id` (NULL = dùng được cho mọi sự kiện, chỉ ADMIN tạo) · `created_by` · `status` (`ACTIVE/REVOKED`) · `api_key_hash` UNIQUE (SHA-256 base64url; plaintext không lưu) · `created_at`, `revoked_at`, `last_seen_at`.

### checkin_records (audit log, append-only)

| Cột | Ghi chú |
|---|---|
| `ticket_id`, `event_id` | `NULL` nếu payload không giải mã được; `event_id` denormalize từ claims để dashboard truy vấn trực tiếp |
| `device_id` | `NULL` nếu API key không khớp thiết bị nào |
| `idempotency_key` UUID **UNIQUE** | do client sinh; chống retry cùng một lần quét |
| `client_checkin_at` | đồng hồ thiết bị — chỉ để ghi nhận, không dùng phân xử |
| `server_received_at`, `created_at` | |
| `outcome` | `ACCEPTED, DUPLICATE, INVALID_SIGNATURE, WRONG_EVENT, EXPIRED_WINDOW, TICKET_VOIDED, DEVICE_NOT_FOUND, DEVICE_REVOKED` |
| `entry_no` | chỉ với `ACCEPTED`: lượt vào thứ mấy (1 với vé dùng một lần) |
| `detail` | mô tả ngắn |

Index quan trọng:

```sql
-- cơ chế chống dùng lại vé: mỗi (vé, số lượt) tối đa MỘT dòng ACCEPTED; vé dùng một lần chỉ có entry_no = 1
CREATE UNIQUE INDEX idx_checkin_records_accepted_entry ON checkin_records (ticket_id, entry_no) WHERE outcome = 'ACCEPTED';
CREATE INDEX idx_checkin_records_event_outcome ON checkin_records (event_id, outcome);  -- dashboard
```

Ứng dụng chỉ `INSERT` vào bảng này (không có đường `UPDATE/DELETE`). Ghi `ACCEPTED` (`CheckinRecordRepositoryAdapter.tryAccept`) chạy trong một transaction: `pg_advisory_xact_lock(hashtextextended(ticket_id))` → kiểm tra `voided_tickets` → đếm số `ACCEPTED` → `INSERT … ON CONFLICT (ticket_id, entry_no) … DO NOTHING` với `entry_no = đếm + 1`. Khóa theo từng vé làm "đếm rồi chèn" thành một bước nguyên tử và là điểm hẹn với `void`/chuyển nhượng (cùng khóa); unique index là chốt chặn cuối. Vẫn là **thứ tự commit** quyết định, không phải đồng hồ thiết bị.

### coupons

`coupon_id` UUID · `event_id` · `code` (chữ hoa, `UNIQUE(event_id, code)`) · `discount_type` `PERCENT` (1..100) / `FIXED` (cents trừ mỗi đơn vị vé, không vượt giá) · `discount_value` · `ticket_type_id` (NULL = mọi loại vé của sự kiện) · `max_redemptions` (NULL = không giới hạn), `redeemed_count` (`CHECK redeemed_count <= max_redemptions`; cập nhật dưới khóa dòng) · `valid_from/valid_until` · `active`.

### waitlist_entries

`entry_id` · `ticket_type_id` · `owner_email`, `holder_name`, `holder_email` · `quantity` (đơn vị, 1..10) · `status` `WAITING/OFFERED/CONVERTED/EXPIRED/CANCELLED` · `reservation_id` (khi `OFFERED`) · `failure_reason` · `offered_at`. Unique index một chỗ sống (`WAITING`/`OFFERED`) cho mỗi `(ticket_type_id, owner_email)`; partial index theo `status` phục vụ job.

### voided_tickets

`ticket_id` PK · `reason` · `voided_at` — read model cục bộ của event `ticket-voided` (upsert bởi `VoidedTicketCacheListener`), tra cứu khi check-in. Chuyển nhượng ghi thẳng vào bảng này, **cùng transaction và cùng khóa advisory** với lần kiểm tra "vé đã quét chưa", để cổng từ chối vé cũ ngay mà không chờ Kafka.

### Quan hệ logic

```text
events 1─* ticket_types 1─* tickets *─1 reservation(reservation_id) 1─1 payment_requests
tickets 1─* checkin_records (qua ticket_id, không có FK — audit phải sống sót dù vé bị thay đổi)
events 1─* coupons ;  tickets *─0..1 coupons (coupon_id)
ticket_types 1─* waitlist_entries ;  waitlist_entry 0..1─1 reservation (khi OFFERED)
tickets: chuỗi chuyển nhượng qua transferred_from (vé mới → vé cũ)
```
