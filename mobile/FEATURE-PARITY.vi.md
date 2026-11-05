# Đối chiếu chức năng frontend → mobile

Phạm vi: các luồng nghiệp vụ có API trong frontend hiện tại. Giao diện dùng React Native/Expo Router, không nhúng website. Không sửa backend, hợp đồng API hay file architecture.

| Frontend | Mobile | Chức năng |
| --- | --- | --- |
| Home, EventDetail | `(tabs)/index`, `events/[id]` | Tìm kiếm, phân trang, danh mục, chi tiết, loại vé/gói/lượt vào, coupon, báo giá, giữ vé, danh sách chờ |
| Login, Register, ForgotPassword, ResetPassword, VerifyEmail, Profile | Các route tài khoản và `(tabs)/profile` | Xác thực, khôi phục phiên, xác minh email, đặt lại mật khẩu, hồ sơ, quyền, đăng xuất |
| Checkout, PaymentGateway, PaymentResult | `checkout/[id]`, `payment-result` | Thanh toán FREE/MOCK/VNPay, mở trình duyệt, đối soát máy chủ, phục hồi giao dịch |
| MyTickets | `(tabs)/tickets`, `tickets/[id]` | Danh sách vé/hàng chờ, QR, gửi lại, chuyển nhượng, tiếp tục thanh toán |
| ManageEvents | `(tabs)/manage`, `event-form` | Tìm/lọc/sắp xếp, tạo/sửa/xuất bản/hủy, danh mục, lịch bán, ảnh bìa |
| EventManagement | `manage/[id]` | Tổng quan, vé, coupon, khách mời tối đa 200, thiết bị, soát vé trực tiếp, CSV |
| SalesChart | `sales-report` trong Tổng quan | Lượt xem, biểu đồ vé/tiền thu và chi tiết theo ngày; 7/30/90 ngày, múi giờ thiết bị, tải lại |
| AdminUsers, AdminDevices, AdminPayments | `admin` và `components/admin` | Phân quyền, khóa người dùng, quản lý thiết bị, tra cứu và hoàn tiền |
| Checkin | `checkin` | Camera/nhập QR, kiểm tra chữ ký offline, lưu hàng đợi, batch/idempotency, đồng bộ và lịch sử |

## Bổ sung trong lần đồng bộ này

- Dùng `category`, `salesStartAt`, `salesEndAt`, `createdAt` có sẵn trong backend. Danh mục MUSIC/SPORTS/SEMINAR/ARTS/COMMUNITY/OTHER. Lọc khám phá trong trang hiện tại; phân trang vẫn hoạt động khi bộ lọc không có kết quả.
- Giữ lịch bán khi sửa; kiểm tra đủ hai mốc, đóng sau mở và không sau kết thúc. Xóa hai mốc gửi `clearSalesSchedule: true`. Màn đặt vé chặn ngoài lịch bán; máy chủ quyết định cuối cùng.
- Chọn ảnh JPG/PNG từ thiết bị bằng Expo ImagePicker, tối đa 5 MB/20 triệu điểm ảnh. Xem trước cục bộ; chỉ gửi multipart có token khi lưu qua `POST /api/manage/event-images`, rồi dùng URL máy chủ để tạo/sửa sự kiện. Có thể tiếp tục nhập URL trực tiếp.
- Ghi lượt xem công khai một lần cho mỗi lần mở chi tiết; thất bại thống kê không chặn mua vé. Tổng quan lấy `GET /api/manage/events/{id}/analytics?days=7|30|90&timezone=...`; lỗi có thể thử lại độc lập với báo cáo sự kiện. Tiền hiển thị quy đổi từ cents như frontend.
- Workflow `.github/workflows/mobile-ci.yml` chạy lint, typecheck, Playwright và export web/Android/iOS trên PR chạm mobile.

## Kiểm tra

`npm run lint`, `npm run typecheck`, `npm run test:browser`; export: `npx expo export --platform all`.
`tests/parity.spec.ts` kiểm tra bộ lọc, lưu/xóa/kiểm tra lịch, multipart ảnh, thời gian mở bán, lượt xem, khoảng thống kê và phục hồi lỗi. Các suite cũ tiếp tục kiểm tra thanh toán, quyền, QR offline, quản trị và bố cục 18 màn.

Playwright chạy web với API fixture, không chứng minh tích hợp backend hay hành vi trên thiết bị thật. Cần chạy development build Android/iOS để xác minh thư viện ảnh, quyền camera, SQLite/SecureStore, VNPay và chia sẻ CSV. Cài lại development build do thêm ImagePicker. Xem tài liệu API SDK 58: https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/.

Các nút frontend chưa có API (sửa hồ sơ/mạng xã hội), bản preview chỉ dành cho development và liên kết universal/app theo tên miền không nằm trong luồng nghiệp vụ đã chạy. CSV native tiếp tục chia sẻ nội dung qua bảng chia sẻ; web tải file.
