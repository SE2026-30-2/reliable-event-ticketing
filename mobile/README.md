# EventHub Mobile

Giao diện 18 màn được chỉnh theo ảnh mẫu `EventHub_Mobile_18_Man_Hinh`. Xem [đối chiếu thiết kế và cách kiểm tra](./UI-REFERENCE.vi.md).

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
EXPO_PUBLIC_IDENTITY_SERVICE_URL=http://192.168.1.10:8087
EXPO_PUBLIC_TICKETING_SERVICE_URL=http://192.168.1.10:8091
```

Điện thoại cần truy cập được cả hai cổng qua LAN. `localhost` trên điện thoại trỏ tới chính điện thoại. Android emulator thường dùng `10.0.2.2`; iOS simulator dùng `localhost`. Expo tunnel chỉ chuyển tiếp Metro, không chuyển tiếp backend. Khởi động lại Expo sau khi thay đổi biến môi trường. Khi đóng gói để sử dụng thực tế, cấu hình URL backend HTTPS.

## Phạm vi đã chuyển

| Nhóm | Chức năng |
| --- | --- |
| Khám phá | Danh sách, tìm kiếm tên/địa điểm, phân trang, chi tiết sự kiện và loại vé |
| Tài khoản | Đăng ký, đăng nhập, khôi phục phiên, hồ sơ và quyền từ `/me`, gửi lại và xác minh email, quên/đặt lại mật khẩu, đăng xuất |
| Đặt vé | Chọn loại/số lượng, báo giá và coupon từ server, giữ vé, tham gia danh sách chờ khi thiếu vé |
| Thanh toán | Checkout từ đặt vé, vé đang giữ hoặc lời mời hàng chờ; VNPay qua trình duyệt hệ thống; miễn phí/mock theo cấu hình backend; tra cứu và đối soát kết quả, phục hồi sau mất phản hồi |
| Vé | Danh sách có phân trang, xem QR của vé đã phát hành, gửi lại email, chuyển nhượng có xác nhận |
| Danh sách chờ | Theo dõi trạng thái và rời hàng chờ có xác nhận |
| Ban tổ chức | Tìm/lọc/sắp xếp sự kiện, tạo/sửa và xác nhận chuyển trạng thái hợp lệ, hiệu lực loại vé, giới hạn/hiệu lực/phạm vi coupon, vé mời đơn lẻ hoặc danh sách tối đa 200 khách, vô hiệu hóa vé có kiểm tra lại lý do, đăng ký/thu hồi và sao chép khóa thiết bị |
| Báo cáo | Doanh thu theo loại vé, số liệu soát vé tự cập nhật mỗi 5 giây khi màn đang mở, biểu đồ theo 15 phút; xuất CSV trên web, chia sẻ nội dung CSV qua bảng chia sẻ trên native |
| Quản trị | Tìm/lọc toàn bộ người dùng theo tên/email/quyền/trạng thái/xác minh, phân trang và xem chi tiết, khóa/mở khóa, cấp/gỡ quyền tổ chức; tìm/lọc/chi tiết thiết bị và chọn sự kiện; tra cứu giao dịch mọi tài khoản theo reservation ID hoặc payment ID, hoàn tiền VNPay đủ điều kiện |
| Soát vé | Camera QR hoặc nhập mã, chứng thư RSA lưu cục bộ, kiểm tra chữ ký/thời hạn/sự kiện offline, phát hiện trùng cục bộ, lịch sử theo thiết bị, hàng đợi bền vững và đồng bộ batch bằng cùng idempotency key |

Các màn hình riêng tư được chặn trước khi tải dữ liệu; backend tiếp tục là nơi kiểm tra quyền và quyền sở hữu. Token được lưu bằng SecureStore trên native, sessionStorage trên bản web. Không suy quyền từ JWT tự giải mã. Phiên trả 401 bị xóa; khôi phục phiên có thử refresh token nếu access token hết hạn.

Các thao tác tạo/sửa dữ liệu không tự động gửi lại; đối soát thanh toán đang chờ được kiểm tra mỗi 5 giây khi màn checkout đang mở. Soát vé giữ nguyên idempotency key khi mất phản hồi. Kết quả offline được đánh dấu tạm thời; chỉ kết quả máy chủ mới được đánh dấu đã xác nhận. Khóa thiết bị không được lưu tự động. Native dùng SQLite cho lịch sử/hàng đợi, web dùng localStorage và Web Locks để phối hợp các tab. Lượt quét chưa xác nhận từ phiên bản cũ được chuyển sang hàng đợi mới.

## Thanh toán và liên kết tài khoản

- Checkout lấy vé của tài khoản qua toàn bộ các trang API, kiểm tra hạn giữ vé và dùng số tiền/trạng thái từ backend. Không truyền `forceOutcome` từ ứng dụng. Nhà cung cấp mock/miễn phí hoàn tất theo phản hồi server; vé có thể xuất hiện sau khi Kafka xử lý phát hành.
- Với VNPay, mở cổng thanh toán, hoàn tất trong trình duyệt rồi quay lại ứng dụng và bấm **Kiểm tra trạng thái thanh toán**. Khi ứng dụng trở lại foreground, màn checkout cũng kiểm tra trạng thái. Nếu tạo thanh toán bị mất phản hồi, phải tra cứu trước khi thử lại. Callback `/payment-result?vnp_TxnRef=...` đối soát với backend, không suy thành công từ `vnp_ResponseCode`.
- Có thể tiếp tục giao dịch sau khi mở lại ứng dụng qua **Vé của tôi → Thanh toán / Kiểm tra giao dịch**. Lời mời `OFFERED` trong danh sách chờ có nút thanh toán riêng.
- Các route `/verify-email?token=...` và `/reset-password?token=...` nhận token trong liên kết; cũng có thể dán giá trị token từ email. Development build dùng scheme `mobile` hiện có, ví dụ `mobile://verify-email?token=...`. Các liên kết HTTPS gửi bởi backend vẫn mở website theo cấu hình máy chủ; chưa cấu hình universal/app links cho tên miền riêng.
- Identity Service dùng `EXPO_PUBLIC_IDENTITY_SERVICE_URL`; vẫn hỗ trợ `EXPO_PUBLIC_USER_SERVICE_URL` trong cấu hình cũ. Backend hiện tại chạy Identity ở 8087 và Ticketing ở 8091.

## Soát vé offline

Trước sự kiện, nhập khóa thiết bị, mã sự kiện và bấm **Cập nhật chứng thư offline** khi còn mạng. Khi mất mạng, QR có chữ ký hợp lệ, đúng thời hạn và sự kiện được đánh dấu tạm chấp nhận; thiếu chứng thư hoặc mã sự kiện thì chờ xác minh. Hàng đợi vẫn nhận lượt quét mới, được lưu qua lần mở ứng dụng và tách theo dấu vân tay khóa thiết bị. Bấm **Đồng bộ lượt quét** khi có mạng; phản hồi thiếu hoặc lỗi không làm mất các lượt chưa xác nhận. Máy chủ có thể trả kết quả khác với kiểm tra cục bộ, hiển thị trong lịch sử.

Kiểm tra offline không biết vé vừa thu hồi hoặc lượt vào đã dùng trên thiết bị khác. Ban tổ chức cần đối soát thường xuyên. Tự đồng bộ mặc định bật, thử mỗi 15 giây khi màn soát vé đang mở, có mạng và có hàng đợi; có thể tắt để đồng bộ thủ công. Giao diện có bộ lọc kết quả và nút xem thêm lịch sử, mỗi lần 30 lượt; toàn bộ lịch sử vẫn được giữ để phát hiện trùng và đồng bộ.

## Phần để lại

- Không thêm bộ lọc danh mục: API sự kiện chưa cung cấp trường danh mục hoặc lọc theo danh mục.
- Không thêm sửa hồ sơ, mạng xã hội hoặc các nút giao diện web chưa có API/luồng hoàn chỉnh.
- API quản trị mới yêu cầu cập nhật `backend/ticketing-platform`: `GET /api/admin/payments/by-reservation/{reservationId}` và `GET /api/admin/payments/{paymentRequestId}`. Chỉ ADMIN được gọi, áp dụng cả VNPay/FREE/MOCK; API người mua tiếp tục kiểm tra quyền sở hữu. Tra cứu không khớp mã hoặc hoàn tiền không được xác nhận sẽ chặn thao tác tiếp theo cho đến khi tra cứu lại.

## Kiểm tra

Chi tiết thay đổi và hợp đồng API màn 13–18: [SCREENS-13-18.vi.md](./SCREENS-13-18.vi.md).

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:browser
npx.cmd expo export --platform android --platform ios --output-dir dist/native
```

Kiểm thử Playwright chạy ở viewport 390×844, giả lập API theo đúng response backend để kiểm tra luồng giao diện. Trên Windows dùng Edge đã cài; trên hệ khác cài Chromium bằng `npx playwright install chromium` hoặc chọn `PLAYWRIGHT_CHANNEL`. Server kiểm thử dùng cổng 8082 và được tự khởi động nếu chưa chạy.

Ảnh và trace nằm trong `test-results/` (không commit). Đây không phải kiểm thử tích hợp backend đang chạy. Cần kiểm tra thêm trên Android/iPhone thật: quyền camera, quét QR thực tế, SecureStore, SQLite/hàng đợi sau khi đóng ứng dụng, Clipboard, kết nối LAN/HTTPS, VNPay sandbox qua trình duyệt và bảng chia sẻ CSV. Nếu dùng development build, build lại sau khi thêm SQLite, Network và Clipboard. Export bundle thành công không thay thế việc build/cài APK hoặc IPA.
