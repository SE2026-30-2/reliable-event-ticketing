# Màn 18 — Quản trị giao dịch & Hoàn tiền

- Route thật: `/admin/payments`, yêu cầu đăng nhập và role `ADMIN`.
- Preview chỉ trong Vite DEV: `/admin/payments/preview`. Bấm Tra cứu với UUID mẫu đã điền; thao tác chỉ có hiệu lực trong phiên xem thử.
- Tách page, CSS, utility/preview và service theo cấu trúc các màn 16–17. Dùng lại Dialog/Icon và CSS quản trị hiện có.
- Gọi trực tiếp ticketing-platform (`VITE_TICKETING_SERVICE_URL`, mặc định port 8091), Bearer access token.
- Tra cứu toàn hệ thống `GET /api/admin/payments/by-reservation/:id` hoặc `GET /api/admin/payments/:paymentId`; hoàn tiền `POST /api/payment/requests/:id/refund`, không gửi body. Kiểm tra UUID và mã trong phản hồi trước khi cho hoàn tiền.
- Chỉ hoàn toàn bộ giao dịch `COMPLETED` của `VNPAY`, số tiền > 0. Modal xác nhận, khóa gửi trùng và đóng modal khi đang gửi. Chỉ cập nhật `REFUNDED` sau phản hồi xác nhận đúng giao dịch từ server. Nếu lỗi hoặc phản hồi không xác nhận, buộc tra cứu lại trước khi thử tiếp.
- Đơn vị `amountCents` chia 100 để hiển thị VND, đúng architecture.md. Không gọi PATCH trạng thái vé để giả lập hoàn tiền: Backend gọi VNPay và phát `payment-refunded` qua outbox/Kafka; catalog cập nhật vé bất đồng bộ.

## Giới hạn hợp đồng Backend hiện có

Backend hiện có `AdminPaymentController` và `GetAdminPaymentUseCase`, yêu cầu ROLE_ADMIN để tra cứu mọi tài khoản bằng reservation ID/payment ID. Use case đọc trực tiếp repository nên hoạt động cả khi online payment tắt, gồm FREE/MOCK. Buyer endpoint cũ giữ kiểm tra chủ reservation. Cần triển khai backend mới cùng giao diện này.

DTO chỉ trả paymentRequestId, reservationId, amountCents, provider, status, txnRef, createdAt, completedAt, paymentUrl, failureReason. Không có thông tin sự kiện, người mua, số vé, thời gian hoàn tiền. Giao diện không dựng các dữ liệu này; nút Xem chi tiết hiển thị các thông tin đặt chỗ đã có. Không hiển thị/link paymentUrl trong trang quản trị.

Mẫu PNG có MoMo, hoàn một phần và lý do hoàn tiền; Backend chỉ hỗ trợ hoàn toàn phần VNPay và không nhận amount/reason, nên không triển khai các trường đó.

## Kiểm tra

`npm run build`, `npm run lint`, `npm run test:screen18:browser`. Browser tests mock hợp đồng API, kiểm tra role/token, UUID, chuyển cents, điều kiện hoàn tiền, xác nhận server, chống gửi trùng, lỗi và responsive. Chưa xác minh hoàn tiền thực với VNPay sandbox/merchant.
