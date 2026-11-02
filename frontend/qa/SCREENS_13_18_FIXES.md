# Kiểm tra và sửa web màn 13–18

Ngày kiểm tra: 02/11/2026. Phạm vi: frontend web hiện có trong workspace.

| Màn | Vấn đề đã sửa |
| --- | --- |
| 13 – Soát vé | Kiểm tra cấu trúc phản hồi, thời gian, mã vé và lượt vào trước khi xác nhận; giữ hàng đợi và idempotency key khi phản hồi lỗi; kiểm tra toàn bộ phản hồi batch trước khi ghi nhận; báo lỗi lưu IndexedDB và xóa kết quả cũ để tránh hiển thị nhầm cho vào; camera chuyển sang jsQR nếu BarcodeDetector không dùng được. |
| 14 – Quản lý sự kiện | Thêm bộ lọc COMPLETED; khóa gửi yêu cầu trùng; kiểm tra ngày hợp lệ; giữ mô tả tối đa 5.000 ký tự theo backend; bỏ qua phản hồi danh sách đã hủy. |
| 15 – Chi tiết quản lý | Khóa các nút sửa, tạo loại vé, tạo coupon và phát vé mời khi sự kiện kết thúc; tránh hiển thị dữ liệu của loader cũ; báo rõ khi tạo thiết bị không trả API key và tải lại danh sách; xác minh kết quả thu hồi thiết bị. |
| 16 – Tài khoản | Chỉ báo thành công khi phản hồi đúng tài khoản và đúng trạng thái hoặc đầy đủ bộ quyền yêu cầu. |
| 17 – Thiết bị | Chỉ xác nhận thu hồi khi phản hồi đúng deviceId và trạng thái REVOKED. |
| 18 – Thanh toán | Kiểm tra đúng giao dịch, đặt chỗ, trạng thái hoàn tiền, số tiền và nhà cung cấp trước khi báo thành công. Giữ luồng tra cứu quản trị theo payment ID hoặc reservation ID đã bổ sung trong workspace. |

## Kết quả xác minh

- `npm run build`: thành công. Vite còn cảnh báo bundle chính lớn hơn 500 kB.
- `npm run test:unit`: 9/9 đạt.
- `npm run test:regression:browser`: 86 đạt, 1 bỏ qua, không có lỗi. Bao gồm màn 14–18, phân quyền và điều hướng. Kiểm thử đăng nhập backend thực bỏ qua vì chưa cấu hình `AUTH_TEST_EMAIL` và `AUTH_TEST_PASSWORD`.
- `CHECKIN_TEST_PORT=5179 npm run test:screen13:browser`: cả 8 kịch bản đạt trên bản production, gồm offline/reload, đồng bộ batch, chống trùng, phản hồi thiếu dữ liệu và lỗi IndexedDB. Tiến trình treo ở bước đóng preview server trên Windows sau khi 8 kịch bản hoàn thành; đã ngắt tiến trình runner, vì vậy lần chạy này không có exit code thành công của toàn bộ runner.
- ESLint cho 6 nhóm màn, checkinService và các test màn 13–18: đạt.
- `git diff --check`: đạt.

## Giới hạn

Các ca trình duyệt dùng API giả lập để kiểm tra cả lỗi máy chủ. Chưa xác minh camera vật lý hoặc giao dịch hoàn tiền VNPay thực tế. Kiểm tra lint toàn frontend còn 12 lỗi và 3 cảnh báo có sẵn ở các trang ngoài phạm vi: Checkout, EventDetail, MyTickets, PaymentGateway và PaymentResult. Không coi kết quả này là xác nhận toàn bộ website không còn lỗi.

Test màn 14 đã được thêm vào runner và ngoại lệ `.gitignore` để có thể đưa cùng thay đổi vào Git. Tham số `CHECKIN_TEST_PORT` cho phép chạy kiểm thử màn 13 bằng một preview server riêng khi cổng mặc định đang bận; runner vẫn không tái sử dụng server đang chạy.
