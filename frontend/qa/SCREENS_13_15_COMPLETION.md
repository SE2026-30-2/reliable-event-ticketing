# Hoàn thiện web màn 13–15

Đối chiếu ba ảnh trong `EventHub_18_man_hinh_rieng`, `docs/business-flows.md`, hợp đồng API và tài liệu bàn giao hiện có. Phạm vi là ứng dụng web `frontend` và backend đang được Docker build từ `backend/src`; không thay đổi ứng dụng `mobile` hoặc các module đang di chuyển dở.

## Màn 13 — `/checkin`

- Camera, đèn pin nếu thiết bị hỗ trợ, đọc ảnh QR, máy quét USB/Bluetooth và nhập tay.
- Nếu BarcodeDetector lỗi khi đang quét, tiếp tục bằng jsQR; không chỉ dự phòng ở bước khởi tạo.
- Kết quả được máy chủ xác nhận có tên sự kiện, tên người giữ vé, loại vé, mã vé và lượt vào. Vé trùng hiển thị lần check-in đầu tiên; lịch sử giữ thông tin qua lần tải lại trang.
- Backend chỉ cung cấp thông tin người giữ vé cho thiết bị đang hoạt động, có đúng khóa và đúng phạm vi sự kiện. Không trả thông tin này cho thiết bị sai khóa, bị thu hồi hoặc sai sự kiện.
- Chứng thư RSA được cache; hàng đợi IndexedDB ghi trước khi gọi API, giữ nguyên idempotency key khi thử lại. Khi có mạng, đồng bộ theo batch; kiểm tra cả mã lượt quét trong phản hồi để tránh xác nhận nhầm.
- Ngoại tuyến xác minh chữ ký và hạn vé tại máy. Không có danh sách người giữ vé tải trước; không thể biết thay đổi ở cổng khác cho đến khi đồng bộ. Kết quả ngoại tuyến luôn ghi rõ chờ đối soát.

## Màn 14 — `/manage`

- Tìm tên/địa điểm không phân biệt hoa thường hoặc dấu tiếng Việt; lọc trạng thái; sắp xếp theo tên, ngày diễn ra hoặc ngày tạo thật (`createdAt`).
- Tạo nháp, xuất bản, sửa, hủy có xác nhận; giữ form khi API lỗi và chặn gửi lặp.
- Danh mục thật: âm nhạc, thể thao, hội thảo, nghệ thuật/điện ảnh, cộng đồng, khác. Lưu trong database và trả về trên API chi tiết/danh sách.
- Lịch mở/đóng bán riêng, nhập theo múi giờ thiết bị và gửi ISO UTC. Cần đủ hai ngày, đóng sau mở và không sau giờ kết thúc sự kiện. Bỏ trống cả hai giữ hành vi cũ: bán từ lúc xuất bản đến khi sự kiện kết thúc. Khi sửa có thể xóa lịch riêng bằng `clearSalesSchedule`.
- Backend thực sự áp dụng lịch khi đặt chỗ và tham gia danh sách chờ; thay đổi lịch không hủy các đặt chỗ đã tồn tại.
- Ảnh bìa: URL HTTP(S) hoặc chọn/kéo thả JPG/PNG tối đa 5 MB, có xem trước. Backend giải mã ảnh để kiểm tra định dạng thật và giới hạn 20 triệu điểm ảnh. Lưu ảnh vào PostgreSQL nên không mất khi container khởi động lại. Nginx chấp nhận request multipart tương ứng.
- Sự kiện cũ thiếu danh mục/lịch vẫn xem và sửa được. API cũ không gửi các trường mới vẫn hoạt động.

## Màn 15 — `/manage/events/:eventId`

- Hiển thị và sửa cùng danh mục, lịch bán, ảnh bìa với màn 14; vẫn kiểm tra quyền quản lý trước khi mở console.
- Biểu đồ số vé mua/tiền thu theo ngày thật, có khoảng 7/30/90 ngày, múi giờ, trục tiền và trục số vé riêng, tooltip, bảng số liệu và trạng thái tải/lỗi/thử lại. Ngày không có giao dịch hiển thị 0.
- Doanh thu lấy từ payment `COMPLETED`, nhóm theo `completed_at`; bỏ giao dịch đã hoàn tiền. Vé gói đếm theo số vé mua; vé mời và bản sao do chuyển nhượng không làm tăng số vé bán.
- Lượt xem lấy từ những lần mở trang sự kiện công khai sau khi tải thành công. Không tăng khi chỉ mở trang quản lý, không phải thống kê người xem duy nhất; bắt đầu thu thập từ bản cập nhật này.
- Các tab loại vé, coupon, phát vé mời, thiết bị, danh sách vé, live dashboard và CSV tiếp tục dùng API thật. Chuyển trạng thái hợp lệ có xác nhận; backend từ chối sửa sự kiện ở trạng thái cuối.
- Thu hồi/hoàn trạng thái vé không tự thực hiện hoàn tiền VNPay; giao diện đã giải thích và dẫn về nghiệp vụ thanh toán riêng.

## API và dữ liệu mới

- Flyway `V11__event_management_details.sql`: danh mục, lịch bán, ảnh và bộ đếm lượt xem.
- POST `/api/manage/event-images`: multipart `file`, chỉ ADMIN/ORGANIZER.
- GET `/api/event-images/{id}`: ảnh công khai, content type được xác minh, cache một năm.
- POST `/api/event/{id}/views`: ghi lượt xem cho sự kiện đang công bố.
- GET `/api/manage/events/{id}/analytics?days=7&timezone=Asia/Ho_Chi_Minh`: chỉ chủ sự kiện/ADMIN; hỗ trợ 7, 30, 90 ngày.
- Event request/response bổ sung `category`, `salesStartAt`, `salesEndAt`; response thêm `createdAt`; PATCH hỗ trợ `clearSalesSchedule`.
- Check-in response thêm `idempotencyKey`, `eventName`, `holderName`, `ticketTypeName`, `firstCheckinAt`.

## Xác minh

- Maven/Docker build: 171/171 test đạt, gồm phân quyền/upload/analytics và lịch mở bán; không có test bị bỏ qua.
- Frontend unit: 9/9; ESLint các file trong phạm vi đạt; build production đạt.
- Playwright: 10 ca màn 13 trên bản production, gồm reload ngoại tuyến và đối soát; 25 ca màn 14–15 gồm tạo/sửa, tải ảnh, danh mục, lịch bán, biểu đồ, phát vé mời, thiết bị, phân trang và CSV.
- `frontend/tests/screens13-15.live.mjs`: kiểm tra trực tiếp PostgreSQL/Kafka/API thật cho upload, lưu/tải lại sự kiện, chặn đặt vé ngoài lịch, phát vé miễn phí, quét/trùng/batch/idempotency, thông tin người giữ vé, lượt xem và báo cáo. Cần `AUTH_TEST_EMAIL`, `AUTH_TEST_PASSWORD` của tài khoản local quản lý. Script tạo một sự kiện QA rồi vô hiệu vé, thu hồi thiết bị và hủy sự kiện; audit vẫn được giữ.
- Chưa thể thay thế kiểm tra camera/đèn pin/máy quét vật lý bằng các ca tự động.

Lệnh chạy từ `frontend`: `npm.cmd run build`, `npm.cmd run test:unit`, `npx.cmd playwright test --config playwright.screens13-15.config.mjs`, `npm.cmd run test:screen13:browser`. Trên Windows có thể chạy preview server riêng, đặt `CHECKIN_TEST_PORT` tương ứng và `CHECKIN_REUSE_TEST_SERVER=1` để runner tái sử dụng server đã mở, tránh chờ đóng Vite sau test.
