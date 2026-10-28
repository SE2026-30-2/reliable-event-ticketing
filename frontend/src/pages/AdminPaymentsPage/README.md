# Màn 18 — Quản trị giao dịch & Hoàn tiền

- Route thật: `/admin/payments`, yêu cầu đăng nhập và role `ADMIN`.
- Preview chỉ trong Vite DEV: `/admin/payments/preview`. Bấm Tra cứu với UUID mẫu đã điền; thao tác chỉ có hiệu lực trong phiên xem thử.
- Tách page, CSS, utility/preview và service theo cấu trúc các màn 16–17. Dùng lại Dialog/Icon và CSS quản trị hiện có.
- Gọi trực tiếp ticketing-platform (`VITE_TICKETING_SERVICE_URL`, mặc định port 8091), Bearer access token.
- Tra cứu `GET /api/payment/requests/by-reservation/:id`; hoàn tiền `POST /api/payment/requests/:id/refund`, không gửi body. Kiểm tra UUID trước khi truy vấn.
- Chỉ hoàn toàn bộ giao dịch `COMPLETED` của `VNPAY`, số tiền > 0. Modal xác nhận, khóa gửi trùng và đóng modal khi đang gửi. Chỉ cập nhật `REFUNDED` sau phản hồi xác nhận đúng giao dịch từ server. Nếu lỗi hoặc phản hồi không xác nhận, buộc tra cứu lại trước khi thử tiếp.
- Đơn vị `amountCents` chia 100 để hiển thị VND, đúng architecture.md. Không gọi PATCH trạng thái vé để giả lập hoàn tiền: Backend gọi VNPay và phát `payment-refunded` qua outbox/Kafka; catalog cập nhật vé bất đồng bộ.

## Giới hạn hợp đồng Backend hiện có

`rp_fe.pdf` trang 14 ghi nhận API tra cứu theo paymentId cần được xác nhận với Backend. Hiện PaymentController không có endpoint này, nên tùy chọn bị vô hiệu hóa và có giải thích. Không tự dựng endpoint hoặc quét dữ liệu để tìm paymentId.

Quan trọng: `OnlinePaymentApplicationService.getByReservation` gọi `reservations.assertOwnedBy` cho mọi caller. Role ADMIN không vượt qua kiểm tra chủ reservation; lookup của đơn người khác nhận 404. API GET còn phụ thuộc online payment được bật. Cần Backend bổ sung use case tra cứu cho ADMIN với kiểm tra role ở server để quản trị viên tra cứu toàn hệ thống. Frontend không bỏ qua hay giả lập quyền này.

DTO chỉ trả paymentRequestId, reservationId, amountCents, provider, status, txnRef, createdAt, completedAt, paymentUrl, failureReason. Không có thông tin sự kiện, người mua, số vé, thời gian hoàn tiền. Giao diện không dựng các dữ liệu này; nút Xem chi tiết hiển thị các thông tin đặt chỗ đã có. Không hiển thị/link paymentUrl trong trang quản trị.

Mẫu PNG có MoMo, hoàn một phần và lý do hoàn tiền; Backend chỉ hỗ trợ hoàn toàn phần VNPay và không nhận amount/reason, nên không triển khai các trường đó.

## Kiểm tra

`npm run build`, `npm run lint`, `npm run test:screen18:browser`. Browser tests mock hợp đồng API, kiểm tra role/token, UUID, chuyển cents, điều kiện hoàn tiền, xác nhận server, chống gửi trùng, lỗi và responsive. Chưa xác minh hoàn tiền thực với VNPay sandbox/merchant.
