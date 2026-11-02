# Mobile — màn 13–18

Các route mobile dùng API Identity Service (8087) và Ticketing Platform (8091). Cần triển khai lại `backend/ticketing-platform` để có API quản trị giao dịch mới. Nếu dùng development build, build lại sau khi cài dependency Clipboard; cập nhật JavaScript đơn thuần không thêm được native module.

| Màn | Luồng đã cập nhật |
| --- | --- |
| 13: Soát vé | Xóa kết quả của lượt trước khi quét mới, kể cả khi lưu trữ lỗi. QR offline, hàng đợi, xác nhận server và idempotency giữ nguyên. |
| 14: Danh sách sự kiện | Khôi phục phiên trước khi tạo navigator để giữ đúng tab; tìm tên/địa điểm có hỗ trợ bỏ dấu, lọc trạng thái và sắp xếp, xem thêm danh sách. |
| 15: Chi tiết sự kiện | Kiểm tra quyền bằng report trước khi mở console. Chỉ cho chuyển trạng thái hợp lệ; xác nhận xuất bản/hủy, khóa trạng thái cuối. Hiệu lực vé tùy chỉnh; coupon có loại vé, giới hạn lượt dùng, thời gian; mời một hoặc tối đa 200 khách. Xác nhận vô hiệu hóa kiểm tra lại lý do. Khóa thiết bị có sao chép, báo cáo từng loại vé, số liệu check-in tự cập nhật 5 giây khi mở màn. |
| 16: Người dùng | Lọc toàn bộ các trang API theo tên/email, quyền, khóa và xác minh; xem chi tiết từ server. Đọc lại tài khoản trước khi cấp/gỡ ORGANIZER để giữ các quyền khác. |
| 17: Thiết bị | Tìm/lọc phạm vi và trạng thái, xem chi tiết, chọn sự kiện theo tên. Khóa chỉ hiển thị một lần, có thể chọn/sao chép; không lưu vào storage và không cho tạo đè khi chưa đóng khóa cũ. |
| 18: Giao dịch | ADMIN tra cứu mọi tài khoản bằng reservation ID hoặc payment ID. Hủy yêu cầu cũ khi sửa mã; kiểm tra mã phản hồi. Hoàn tiền có xác nhận, chống gửi lặp, khóa sửa mã khi gửi và buộc tra cứu lại sau phản hồi không chắc chắn. |

## API quản trị giao dịch

- `GET /api/admin/payments/by-reservation/{reservationId}`
- `GET /api/admin/payments/{paymentRequestId}`

Cả hai chỉ cho `ROLE_ADMIN`: anonymous nhận 401, USER/ORGANIZER nhận 403, mã không tồn tại nhận 404, UUID không hợp lệ nhận 400. API hoạt động với các payment đã lưu của VNPay/FREE/MOCK, kể cả khi online provider tắt. Response dùng `PaymentRequestResponse` hiện có; không phát sinh thanh toán hoặc gọi gateway khi tra cứu.

API buyer `GET /api/payment/requests/by-reservation/{id}` vẫn kiểm tra chủ reservation. Hoàn tiền tiếp tục dùng `POST /api/payment/requests/{id}/refund` cho ADMIN, chỉ VNPay COMPLETED và hoàn toàn bộ; cập nhật vé qua outbox/Kafka. Giao diện web màn 18 cũng dùng hai API quản trị mới.

## Kiểm thử

Trong `mobile`: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:browser`, `npx.cmd expo export --platform android --platform ios --output-dir dist/native --max-workers 2`.

Trong `backend/ticketing-platform`, dùng Java 21 và Maven: `mvn.cmd -Dtest=GetAdminPaymentApplicationServiceTest,AdminPaymentControllerTest,BuyerEndpointsSecurityTest,ManagementEndpointsSecurityTest test`.

Trong `frontend`: `npm.cmd run test:screen18:browser`, `npm.cmd run build`. Lint toàn repository có lỗi sẵn ở các màn checkout/vé/kết quả thanh toán ngoài phạm vi 13–18; kiểm tra riêng các file màn 18 bằng ESLint.

Browser tests dùng API giả lập. Security tests backend chạy filter chain Spring thật với principal kiểm thử. Chưa thay thế kiểm tra trên điện thoại thật: Clipboard, SQLite đầy/lỗi, camera, deep links và giao dịch/hoàn tiền VNPay sandbox.
