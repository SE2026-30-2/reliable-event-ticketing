# EventPass Mobile

Ứng dụng React Native / Expo SDK 58 chuyển các luồng hiện có của `frontend` sang Android và iOS. Dùng Expo Router, TypeScript và API của hệ thống hiện tại. Không dùng WebView hoặc dữ liệu demo trong ứng dụng.

## Chạy ứng dụng

```powershell
cd mobile
npm.cmd ci
npm.cmd start
```

Mở bằng Expo Go tương thích SDK 58 hoặc development build. Có thể xem trước giao diện bằng `npm.cmd run web`. Hướng dẫn Windows và kết nối điện thoại: [SETUP.vi.md](./SETUP.vi.md).

Backend cần chạy Identity ở cổng 8087 và Ticketing ở cổng 8091. Khi chạy development, ứng dụng tự dùng hostname của Expo server để gọi backend. Nếu dùng emulator, tunnel, hoặc backend ở máy khác, sao chép `.env.example` thành `.env.local` và sửa hai địa chỉ API:

```dotenv
EXPO_PUBLIC_USER_SERVICE_URL=http://192.168.1.10:8087
EXPO_PUBLIC_TICKETING_SERVICE_URL=http://192.168.1.10:8091
```

Điện thoại cần truy cập được cả hai cổng qua LAN. `localhost` trên điện thoại trỏ tới chính điện thoại. Android emulator thường dùng `10.0.2.2`; iOS simulator dùng `localhost`. Expo tunnel chỉ chuyển tiếp Metro, không chuyển tiếp backend. Khởi động lại Expo sau khi thay đổi biến môi trường. Khi đóng gói để sử dụng thực tế, cấu hình URL backend HTTPS.

## Phạm vi đã chuyển

| Nhóm | Chức năng |
| --- | --- |
| Khám phá | Danh sách, tìm kiếm tên/địa điểm, phân trang, chi tiết sự kiện và loại vé |
| Tài khoản | Đăng ký, đăng nhập, khôi phục phiên, hồ sơ và quyền từ `/me`, gửi lại email xác minh, đăng xuất |
| Đặt vé | Chọn loại/số lượng, báo giá và coupon từ server, giữ vé, tham gia danh sách chờ khi thiếu vé |
| Vé | Danh sách có phân trang, xem QR của vé đã phát hành, gửi lại email, chuyển nhượng có xác nhận |
| Danh sách chờ | Theo dõi trạng thái và rời hàng chờ có xác nhận |
| Ban tổ chức | Danh sách sự kiện, tạo/sửa thông tin và trạng thái, tạo loại vé, coupon, vé mời, vô hiệu hóa vé, đăng ký/thu hồi thiết bị |
| Báo cáo | Doanh thu, soát vé và biểu đồ theo 15 phút; xuất CSV trên web, chia sẻ nội dung CSV qua bảng chia sẻ trên native |
| Quản trị | Phân trang người dùng, khóa/mở khóa, cấp/gỡ quyền tổ chức, thiết bị toàn hệ thống, tra cứu và hoàn tiền VNPay đủ điều kiện |
| Soát vé | Camera QR hoặc nhập mã, xác thực bằng khóa thiết bị, lưu lượt chưa được xác nhận và thử lại bằng cùng idempotency key |

Các màn hình riêng tư được chặn trước khi tải dữ liệu; backend tiếp tục là nơi kiểm tra quyền và quyền sở hữu. Token được lưu bằng SecureStore trên native, sessionStorage trên bản web. Không suy quyền từ JWT tự giải mã. Phiên trả 401 bị xóa; khôi phục phiên có thử refresh token nếu access token hết hạn.

Các thao tác gây thay đổi không tự động thử lại. Riêng soát vé giữ nguyên idempotency key khi mất phản hồi, và không báo chấp nhận nếu chưa nhận kết quả từ server. Khóa thiết bị không được lưu tự động.

## Phần để lại

- Checkout / payment gateway / payment result của web đang giả lập thành công bằng timer, chưa nối luồng thanh toán thực. Mobile dừng ở xác nhận giữ vé và thông báo rõ chưa hỗ trợ thanh toán; không tự phát hành vé hoặc báo đã thanh toán.
- Không thêm bộ lọc danh mục: API sự kiện chưa cung cấp trường danh mục hoặc lọc theo danh mục.
- Không thêm sửa hồ sơ, mạng xã hội, quên mật khẩu hoặc các nút giao diện web chưa có luồng hoàn chỉnh.
- Soát vé mobile hiện cần máy chủ xác nhận. Chưa chuyển bộ xác minh chữ ký offline và đồng bộ hàng loạt IndexedDB/Web Locks của web sang native. Có lưu một lượt chưa xác nhận qua lần mở ứng dụng, và chặn quét mới cho tới khi xử lý xong lượt đó.
- Không thay đổi API hoặc backend.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:browser
npx.cmd expo export --platform android --platform ios --output-dir dist/native
```

Kiểm thử Playwright chạy ở viewport 390×844, giả lập API theo đúng response backend để kiểm tra luồng giao diện. Trên Windows dùng Edge đã cài; trên hệ khác cài Chromium bằng `npx playwright install chromium` hoặc chọn `PLAYWRIGHT_CHANNEL`. Server kiểm thử dùng cổng 8082 và được tự khởi động nếu chưa chạy.

Ảnh và trace nằm trong `test-results/` (không commit). Đây không phải kiểm thử tích hợp backend đang chạy. Cần kiểm tra thêm trên Android/iPhone thật: quyền camera, quét QR thực tế, SecureStore, kết nối LAN/HTTPS và bảng chia sẻ CSV. Export bundle thành công không thay thế việc build/cài APK hoặc IPA.
