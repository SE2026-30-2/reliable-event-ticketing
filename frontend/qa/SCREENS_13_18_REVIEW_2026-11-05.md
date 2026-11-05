# Rà soát frontend web màn 13–18 — 05/11/2026

Phạm vi rà soát ban đầu: mã frontend tại commit `aa5ea7d`, các API liên quan được đối chiếu bằng mã backend và tài liệu hiện có. Cả ba lỗi bên dưới đã được sửa trong workspace theo yêu cầu tiếp theo; kết quả kiểm chứng bản sửa nằm ở cuối báo cáo.

## Lỗi đã tái hiện

### 1. [P2] Màn 14 có thể lưu ảnh của form trước vào sự kiện đang chỉnh sửa

- Vị trí: `src/components/events/BannerUpload.jsx:7–21`, `src/pages/ManageEventsPage/ManageEvents.jsx:102–107`.
- Chọn ảnh khi tạo sự kiện mới; trong lúc `createImageBitmap` hoặc `FileReader` đang xử lý, chuyển sang chỉnh sửa một sự kiện có sẵn. Callback đọc ảnh vẫn gọi `onFile` và `onChange`, cập nhật form mới.
- Đã tái hiện bằng cách trì hoãn `createImageBitmap`, chuyển sang chỉnh sửa sự kiện `review`, rồi cho đọc ảnh tiếp tục. PATCH của sự kiện có sẵn chứa URL ảnh chọn từ form tạo mới.
- Ảnh hưởng: thay nhầm ảnh bìa khi người dùng lưu sự kiện khác.
- Hướng sửa: hủy hoặc bỏ qua kết quả đọc ảnh đã hết hiệu lực khi đổi/reset form, chọn ảnh khác hoặc unmount; kiểm soát trạng thái đang đọc ảnh trước khi lưu. Chỉ thêm `key` mà không chặn callback cũ là chưa đủ.

### 2. [P2] Màn 13 từ chối nhầm vé offline khi mã sự kiện viết hoa

- Vị trí: `src/services/checkinCrypto.js:32`.
- Ô cấu hình mã sự kiện chấp nhận UUID viết hoa, nhưng `verifyOffline` so sánh hai chuỗi bằng `!==`.
- Đã ký QR hợp lệ với event ID `abcdefab-abcd-abcd-abcd-abcdefabcdef`. Cấu hình cùng mã viết thường trả `ACCEPTED`; chuyển sang chữ hoa trả `WRONG_EVENT`.
- Ảnh hưởng: từ chối vé hợp lệ khi offline; khi có mạng, xác nhận backend có thể che khuất lỗi này.
- Hướng sửa: so sánh UUID sau khi chuẩn hóa chữ thường. Thêm ca kiểm thử UUID cùng giá trị nhưng khác kiểu chữ.

### 3. [P2] Màn 15 báo lưu thành công khi lựa chọn bỏ danh mục không được lưu

- Vị trí: `src/pages/EventManagementPage/EventManagement.jsx:46–48`.
- Sự kiện đang có danh mục MUSIC; mở chỉnh sửa, chọn “Chưa phân loại”, rồi lưu.
- Frontend chuyển giá trị rỗng thành `undefined`, nên JSON PATCH không chứa `category`. Backend chỉ cập nhật danh mục nếu giá trị khác null (`EventApplicationService.java:65`).
- Đã tái hiện với API giả lập theo quy tắc backend: thông báo “Đã lưu thông tin sự kiện.” xuất hiện, PATCH không có `category`, và danh mục vẫn là MUSIC.
- Hướng sửa trong phạm vi frontend: vô hiệu hóa lựa chọn rỗng khi sự kiện đã có danh mục, tương tự màn 14. Nếu cần chức năng bỏ danh mục thật sự, phải thống nhất thay đổi hợp đồng API riêng.

## Phạm vi đã kiểm tra

| Màn | Các luồng chính |
| --- | --- |
| 13 — Soát vé | Nhập tay, máy quét, xác nhận máy chủ, chữ ký QR, offline/reload, hàng đợi riêng theo key, batch, lỗi lưu trữ, camera bị từ chối quyền |
| 14 — Quản lý sự kiện | Danh sách, tìm kiếm/bộ lọc, trạng thái kết thúc, tạo/sửa/hủy, lịch bán, mô tả dài, upload ảnh |
| 15 — Chi tiết quản trị sự kiện | Tổng quan, analytics, loại vé, coupon, khách mời, thiết bị, vé, live dashboard, CSV, chặn sửa sự kiện kết thúc |
| 16 — Người dùng | Quyền ADMIN, phân trang/tìm kiếm/bộ lọc, chi tiết, cấp/thu hồi ORGANIZER, khóa/mở khóa, phản hồi không xác nhận thay đổi |
| 17 — Thiết bị | Quyền ADMIN, phân trang/bộ lọc, tạo toàn cục/theo sự kiện, API key một lần, thu hồi và lỗi API |
| 18 — Thanh toán | Tra cứu hai loại ID, chống dữ liệu cũ, điều kiện hoàn tiền, xác nhận hoàn, chặn gửi trùng và kết quả không chắc chắn |

Chưa phát hiện lỗi mới ở màn 16–18 trong các luồng đã kiểm tra; điều này không khẳng định các màn hoàn toàn không còn lỗi.

## Kết quả kiểm tra lần này

- `npm ci`: hoàn tất. npm báo 4 cảnh báo bảo mật mức moderate; chưa thay đổi dependency trong đợt rà soát.
- `npm run lint`: exit code 0.
- `npm run test:unit`: exit code 0; 9/9 đạt.
- `npm run build`: exit code 0. Còn cảnh báo bundle chính khoảng 583 kB sau minify.
- `npm run test:regression:browser`: 89 ca in kết quả đạt, 1 ca đăng nhập backend thật bỏ qua vì thiếu cấu hình tài khoản kiểm thử.
- `npm run test:screen13:browser`: cả 10 ca in kết quả đạt.
- Hai runner Playwright treo khi đóng web server trên Windows sau khi thực thi các ca; đã ngắt bằng Ctrl+C. Vì vậy không báo exit code thành công cho toàn bộ runner. File JSON báo cáo regression có sẵn từ 02/11 không được dùng làm kết quả lần này.
- Ca tái hiện bổ sung: `node tmp/audit-review.mjs` hoàn tất với exit code 0, xác nhận lỗi ảnh bìa màn 14 và danh mục màn 15. Script nằm trong thư mục tạm bị Git bỏ qua.
- Kiểm chứng trực tiếp `verifyOffline` bằng QR ký RSA xác nhận lỗi UUID viết hoa màn 13.

Các ca trình duyệt dùng API giả lập. Chưa kiểm tra backend đang chạy, camera vật lý hoặc hoàn tiền VNPay thực tế. Không sửa `docs/setup.md` hay thư mục ảnh cục bộ của người dùng.

## Bản sửa và kiểm chứng sau rà soát

- **Màn 14:** mỗi lần mở/reset form tạo một phiên đọc ảnh mới. `BannerUpload` hủy FileReader và bỏ qua kết quả bất đồng bộ cũ khi unmount hoặc chọn ảnh khác. Form khóa lưu/xuất bản và ô URL trong lúc đang đọc ảnh, đồng thời vẫn cho phép chuyển sang form khác. Đổi/reset form hoặc hủy sự kiện đang sửa cũng xóa file ảnh đang chọn.
- **Màn 13:** đối chiếu event UUID không phân biệt chữ hoa/thường; vé của sự kiện khác vẫn bị từ chối. Không thay nội dung QR đã ký.
- **Màn 15:** lựa chọn “Chưa phân loại” bị vô hiệu hóa nếu sự kiện đã có danh mục, giống màn 14. Vẫn cho phép đổi sang danh mục khác. Không thay hợp đồng API/backend.

Đã thêm 6 ca hồi quy: 1 unit test UUID, 4 ca trình duyệt ảnh bìa (trì hoãn giải mã ảnh, trì hoãn FileReader, reset form tạo mới và ảnh cũ hoàn thành sau ảnh mới), 1 ca trình duyệt danh mục (kiểm tra lựa chọn rỗng bị khóa, điều hướng bàn phím và PATCH giữ danh mục hiện tại).

Kết quả sau sửa:

- `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build`: exit code 0; unit test 10/10 đạt. Build còn cảnh báo bundle chính trên 500 kB đã có trước.
- Bộ regression mở rộng: 93 ca đạt, 1 bỏ qua, 1 ca mới lỗi phép kiểm tra `toBeDisabled()` trên phần tử `<option>` dù DOM đã có `disabled`. Đã sửa phép kiểm tra sang thuộc tính DOM kết hợp bàn phím; chạy riêng ca đó lại đạt, exit code 0. Không thay đổi mã ứng dụng để xử lý lỗi phép kiểm tra.
- Bộ màn 13 trên production build: 10/10 đạt, exit code 0.
- Tổng cộng **104 ca trình duyệt đạt sau khi chạy lại ca đã sửa**, 1 ca đăng nhập backend thật bỏ qua. Các ca còn lại không chạy lại vì không có thay đổi mã ứng dụng sau lần chạy bộ đầy đủ.
- Dùng server Vite do script tạm quản lý và cấu hình Playwright không tự khởi động webServer để tránh lỗi treo khi đóng server trên Windows. Cả hai lần chạy đều kết thúc; không cần ngắt runner. Cấu hình/script và JSON kết quả nằm trong `frontend/tmp/`, bị Git bỏ qua.
- `git diff --check`: đạt.

Giới hạn kiểm chứng vẫn như đợt rà soát: API giả lập; chưa kiểm tra camera vật lý, backend thật hoặc hoàn tiền VNPay thực tế.
