# Giao diện EventHub Mobile theo bộ ảnh 18 màn

Nguồn đối chiếu: `EventHub_Mobile_18_Man_Hinh/EventHub_Mobile_18_Man_Hinh/` tại thư mục gốc repository. Ảnh tham chiếu của người dùng được giữ nguyên.

## Phạm vi giao diện

| Màn | Đường dẫn | Thay đổi chính |
| --- | --- | --- |
| 01 | `/login` | Logo EventHub, tiêu đề giữa, ảnh concert, trường có biểu tượng, bật/tắt mật khẩu, liên kết khôi phục |
| 02 | `/register` | Bố cục đăng ký đồng bộ, ảnh concert và thông báo kết quả |
| 03 | `/verify-email` | Minh họa phong bì, xác minh qua token, trạng thái thành công và nút khám phá |
| 04 | `/forgot-password` | Gửi hướng dẫn qua email, thông báo an toàn và lưu ý Spam |
| 05 | `/reset-password` | Minh họa ổ khóa, nhập token, mật khẩu mới và xác nhận |
| 06 | `/profile` | Ảnh bìa, avatar chữ cái từ tên thật, vai trò, thông tin cá nhân, bảo mật và đăng xuất |
| 07 | `/` | Tìm kiếm và thẻ sự kiện ngang với banner, địa điểm, lịch và điều hướng |
| 08 | `/events/:id` | Banner thật, thông tin sự kiện, thẻ chọn loại vé, số lượng và tổng tiền từ quote API |
| 09 | `/checkout/:id` | Thời gian giữ chỗ, thông tin vé/người nhận và trạng thái thanh toán |
| 10 | `/payment-result` | Minh họa kết quả, thông tin giao dịch và liên kết vé; trạng thái luôn theo backend |
| 11 | `/tickets` | Chuyển Vé/Hàng đợi, QR xem trước chỉ cho vé ISSUED và các thao tác hiện có |
| 12 | `/tickets/:id` | Banner gọn, QR lớn lên đầu, hiệu lực, cảnh báo và thông tin vé |
| 13 | `/checkin` | Ưu tiên vùng quét; thu gọn cài đặt thiết bị, khung camera, trạng thái kết quả và lịch sử |
| 14 | `/manage` | Thẻ ngang, tìm kiếm/bộ lọc; tạo sự kiện bằng bảng trượt |
| 15 | `/manage/:id` | Banner, trạng thái, tab xuống dòng và thống kê từ báo cáo thực |
| 16 | `/admin` → Người dùng | Thống kê thực, bộ lọc thu gọn, avatar chữ và menu thao tác mỗi tài khoản |
| 17 | `/admin` → Thiết bị | Phạm vi/bộ lọc, menu từng thiết bị; bảng tạo thiết bị và bảng API key một lần |
| 18 | `/admin` → Thanh toán | Tra cứu theo mã, tóm tắt thanh toán và bảng xác nhận hoàn tiền |

Màu nền sáng, tím chủ đạo, nút gradient, biểu tượng SVG, thẻ và trường nhập được dùng chung trên các màn. Ảnh trang trí được đóng gói trong ứng dụng; banner sự kiện vẫn lấy từ backend và có placeholder khi thiếu hoặc tải lỗi. Nguồn ảnh minh họa: [assets/eventhub/README.md](./assets/eventhub/README.md).

## Các khác biệt có chủ đích với ảnh mẫu

- Không dựng các nút Google/GitHub, yêu thích, ghế/cổng vào, phí dịch vụ hoặc hoàn tiền một phần khi hệ thống chưa có API tương ứng.
- Không hiển thị sẵn thông báo thành công, vé hợp lệ hoặc kết quả cho vào nếu chưa có xác nhận tương ứng.
- Không chép số liệu, hồ sơ và giao dịch trong ảnh mẫu thành dữ liệu của ứng dụng. Fixtures minh họa chỉ có trong test.
- Giữ cách nhập token thủ công để các liên kết email tiếp tục dùng được cả khi chưa cấu hình app links.
- Ảnh và minh họa được thay bằng tài sản có thể dùng trong ứng dụng; không dùng ảnh chụp màn hình làm giao diện.

## Chạy và kiểm tra

Chạy development:

```powershell
cd mobile
npx expo start -c
```

Kiểm tra mã và xuất bản web để xem trước:

```powershell
npm run typecheck
npm run lint
npm run build:web
npm run preview:web
```

Trong terminal khác tại `mobile`, chạy `npm run test:production`. Preview chỉ lắng nghe `127.0.0.1:8084`; dừng bằng Ctrl+C khi không sử dụng. Runner tách vòng đời server để tránh treo đóng tiến trình trên Windows.

`tests/design.spec.ts` mở đủ 18 màn và các bảng tạo sự kiện/xác nhận hoàn tiền, kiểm tra không tràn ngang ở 320 px và 390 px, bắt lỗi runtime và lưu ảnh ở `test-results/eventhub/`. Báo cáo JSON ở `test-results/production-report.json`. Các file này cùng build output nằm trong diện ignore.

Kiểm tra trình duyệt dùng API giả lập. Cần kiểm tra thêm trên điện thoại thực cho bàn phím, camera, safe area và thao tác quét; không coi screenshot trình duyệt là xác nhận hoàn tiền thật hoặc camera vật lý.

## Kết quả kiểm tra ngày 02/11/2026

- TypeScript và ESLint: đạt, không có lỗi/cảnh báo lint.
- Toàn bộ bộ kiểm thử production: 29/29 đạt, không bỏ qua. Sau chỉnh sửa minh họa trạng thái thanh toán, chạy lại hai ca liên quan (duyệt 18 màn và xác nhận kết quả theo backend): 2/2 đạt.
- Đã kiểm tra ảnh chụp của 18 màn; lưu 20 ảnh gồm hai trạng thái bảng trượt. Kiểm tra tự động không tràn ngang ở 320 và 390 px.
- Xuất bundle web, Android Hermes và iOS Hermes: thành công. Đây là kiểm tra đóng gói mã/tài sản, không phải bản APK/IPA đã ký hoặc kiểm tra thiết bị vật lý.
- `git diff --check`: đạt.

Ảnh xem trước sau khi chạy test: [Đăng nhập](./test-results/eventhub/01-dang-nhap.png), [Vé QR](./test-results/eventhub/12-ve-qr.png), [Soát vé](./test-results/eventhub/13-soat-ve.png), [Xác nhận hoàn tiền](./test-results/eventhub/18b-xac-nhan-hoan-tien.png).
