# Sửa lỗi frontend theo báo cáo — 05/11/2026

Phạm vi: 11 phát hiện F01–F11 trong [báo cáo review](FRONTEND_DOCS_REVIEW_2026-11-05.md). Mã sửa, thư viện, cấu hình kiểm thử và tài liệu bàn giao nằm trong `frontend`. Không sửa backend, hợp đồng API, database, Docker hoặc `.env`.

## Thay đổi

| Mục | Hành vi sau sửa |
| --- | --- |
| F01 | Kết quả được đối soát qua API. Query `vnp_ResponseCode=00` và state `success` không xác nhận thanh toán. Trang không có mã giao dịch hiển thị trạng thái trống. Đã bỏ bộ nút mô phỏng trong trang production. |
| F02 | `TicketQr` tạo PNG từ `qrPayload` của từng vé `ISSUED`, ngay trong trình duyệt. Vé chưa phát hành/đã vô hiệu không hiển thị QR khả dụng. Kích thước hiển thị 256 px được kiểm tra bằng giải mã ảnh ở kích thước thực tế, gồm mobile. |
| F03 | Request đặt chỗ dùng tên/email đang hiển thị trong form và trim trước khi gửi. |
| F04 | URL chuẩn dùng reservation ID. Checkout khôi phục vé của người đăng nhập từ API hiện có, tải đủ các trang khi mở link email hoặc tải lại. |
| F05 | Chuyển nguyên ticket IDs, tổng/giảm giá từ response đặt chỗ; checkout đọc lại giá đã chốt trên vé từ server và đếm ngược theo expiry thật. Theo dõi phát hành bất đồng bộ tại trang kết quả, không dùng mảng vé rỗng để xác nhận đã phát hành. |
| F06 | Cả `/payment/result` và `/payment-result` được hỗ trợ. |
| F07 | Báo giá chỉ có hiệu lực cho đúng loại vé/số lượng/coupon hiện tại; hủy/bỏ qua phản hồi cũ. Lỗi coupon được hiển thị và khóa mua; không tự tạo mức giảm giá. Báo giá miễn phí 0 đồng được chấp nhận. |
| F08 | Polling chạy độc lập với countdown, dùng một request tại một thời điểm, dọn timer và hủy request khi rời trang. Thời hạn dựa trên reservation, không tự đặt 15 phút. Người mua mở link VNPay thật để thanh toán; đã bỏ dịch vụ QR ảnh bên ngoài. |
| F09 | Danh sách chờ dùng `entryId`; offer thanh toán dùng `reservationId`. Hủy chỉ loại đúng entry; trạng thái đã kết thúc không hiện nút thanh toán như OFFERED. |
| F10 | Tải đủ các trang API vé cá nhân trước khi phân trang giao diện, không bỏ các vé ngoài trang đầu. |
| F11 | Danh mục lọc thật theo `event.category`, có thông báo khi không có kết quả. |

Client chung cũng giữ HTTP status/headers trên lỗi để frontend còn xử lý được lỗi nghiệp vụ và xác thực. Chưa mở rộng cơ chế tự refresh phiên; đây là ghi nhận bổ sung trong review, ngoài 11 phát hiện được sửa trong đợt này.

## Tương thích API hiện có

- Không có endpoint đọc riêng reservation: dùng `/api/my/tickets?page&size` hoặc `/api/ticket/{id}` của chính người mua. Không truy cập endpoint quản trị để khôi phục đơn của người mua.
- GET payment theo reservation chỉ bật khi backend dùng online payment. Khi GET trả 404, trang kết quả chỉ xác nhận đã phát hành sau khi đọc được các vé `ISSUED` từ server. Nó không tự POST tạo/thu tiền khi người dùng mở trang kết quả.
- Với VNPay, trạng thái payment luôn lấy từ API sync/lookup, có kiểm tra mã giao dịch/reservation và cấu trúc response. `PENDING`, lỗi mạng, `REFUND_REQUIRED` hoặc `REFUNDED` không bị đổi thành thành công bởi query string.
- UI phân biệt máy chủ đã xác nhận thanh toán với vé còn đang phát hành. Vé chỉ xuất hiện QR khi có payload trên ticket `ISSUED`.
- Checkout bỏ các lựa chọn giả lập của trang cũ. Backend quyết định provider và số tiền; request thanh toán bình thường không gửi `forceOutcome`.

## Dependency và bảo mật dữ liệu QR

Thêm `qrcode` 1.5.4 trong frontend và cập nhật lockfile qua npm sau bước phê duyệt cài dependency. Bộ mã hóa hỗ trợ trình duyệt theo [tài liệu chính thức](https://github.com/soldair/node-qrcode#browser). Không sao chép mã nguồn thư viện vào repo; QR được sinh thành data URL cục bộ.

Giữ `jsqr` sẵn có để giải mã trong kiểm thử. Fixture QR có chuỗi payload dài theo dạng compact RSA, bao gồm đoạn chữ ký 256 byte giả lập; test xác nhận dữ liệu ảnh khớp chính xác từng ticket, không chỉ so sánh hai ảnh khác nhau.

## Kiểm thử

- Thêm `tests/buyerServices.test.mjs`: phân trang đầy đủ, khôi phục reservation, đơn 0 đồng, giữ status/headers lỗi và kiểm tra phản hồi payment.
- Thêm 14 ca `tests/buyer-flow.spec.mjs`: đặt vé bằng thông tin điền sẵn, giá/hạn giữ chỗ, link email, đơn free/bundle, pending/thất bại/hoàn tiền, callback giả, lỗi mạng, phát hành chậm, QR thật, coupon sai, polling, danh sách chờ, phân trang và lọc danh mục.
- Test QR giải mã theo kích thước hiển thị của ảnh, có viewport 390 px. Lần kiểm tra này phát hiện QR 192 px chưa ổn định; đã tăng lên 256 px và bố trí QR riêng trong thẻ vé.
- Đưa buyer suite vào regression; thêm `playwright.buyer.config.mjs` và `npm run test:buyer:browser` để chạy trên production build.
- Sửa test navigation cũ vốn kỳ vọng `/payment/result` là 404, theo route mới đã hỗ trợ.
- Tách cache Vite của các unit test và tắt WebSocket trong server SSR kiểm thử để tránh tranh cổng/cache với dev server.

Kết quả cuối trên mã đã sửa:

| Kiểm tra | Kết quả |
| --- | --- |
| `npm ci` từ lockfile cập nhật | Exit 0, cài đặt thành công |
| `npm run lint` | Exit 0 |
| `npm run test:unit` | Exit 0; 11/11 đạt, không còn lỗi tranh cổng WebSocket |
| `npm run build` | Exit 0; bundle chính khoảng 581 kB |
| Regression đầy đủ, gồm buyer suite và màn 14–18 | Exit 0; 108 đạt, 1 bỏ qua, 0 lỗi/0 flaky |
| Production: buyer suite + soát vé màn 13 | Exit 0; 24/24 đạt, 0 bỏ qua/0 flaky |
| `git diff --check` | Đạt |

Tổng cộng 132 lượt kiểm thử trình duyệt đạt trên hai môi trường. Ca bỏ qua là đăng nhập backend thật khi chưa cấu hình tài khoản QA. JSON lần chạy cuối tại `frontend/tmp/current-regression-results.json` (02:11:14 UTC) và `frontend/tmp/current-production-results.json` (02:08:34 UTC), ngày 05/11/2026.

Các lượt trung gian đã phát hiện test route lỗi thời và vấn đề kích thước QR nêu trên; chúng được sửa trước khi chạy lại. Có hai ca dev bị trang trắng khi chạy đồng thời với unit test dùng chung Vite; sau khi tách cache và chạy kiểm tra tuần tự, cả bộ regression cuối đạt. Không dùng kết quả của lượt lỗi để thay cho kết quả cuối.

Đã xem ảnh desktop/mobile của checkout, kết quả và vé cá nhân. Các ca mobile kiểm tra viewport 390×844 không tràn ngang; QR được giải mã theo kích thước hiển thị thực tế trên cả desktop và mobile. Các thumbnail bên ngoài trong fixture có thể không tải vì bài test chặn request HTTPS bên ngoài; không dùng chúng để kết luận backend lưu ảnh lỗi.

Server kiểm thử được khởi động trực tiếp bằng Vite và đóng sau runner bằng script tạm `frontend/tmp/run-current-tests.mjs`, tránh lỗi chờ đóng webServer trên Windows. Script/cấu hình tạm và ảnh QA không đưa vào Git; test nguồn và runner chính thức được thêm ngoại lệ `.gitignore` để có thể review/commit.

## Giới hạn

API của các ca trình duyệt được giả lập theo DTO/controller đã đối chiếu. Chưa chạy backend/Kafka thật, thanh toán VNPay thật, camera hay máy quét vật lý. Cảnh báo bundle chính trên 500 kB vẫn còn. npm audit ghi nhận 4 cảnh báo moderate như trước khi thêm QR; không chạy cập nhật phá vỡ tương thích bằng `audit fix --force`.

Các bản sửa màn 13/14/15 từ lượt trước và thay đổi cục bộ ngoài frontend của người dùng được giữ nguyên. Chưa commit hoặc push.
