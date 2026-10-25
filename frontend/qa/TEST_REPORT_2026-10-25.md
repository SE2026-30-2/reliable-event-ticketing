# Báo cáo kiểm thử web - 25/10/2026

## Kết luận

Các chức năng đã triển khai được kiểm tra bằng trình duyệt với backend Docker thật, kiểm thử hồi quy có mock API và kiểm thử đơn vị. Tổng cộng **103 kịch bản đạt**, không có kịch bản bỏ qua trong các lượt chạy cuối. Build, lint và `git diff --check` đạt.

**Chưa thể xem website là hoàn thiện toàn bộ 18 màn:** luồng mua vé từ giao diện, checkout, kết quả VNPay, vé của tôi và xác minh/khôi phục tài khoản còn thiếu. Các chức năng quản trị đã có hoạt động với backend local trong phạm vi kiểm tra bên dưới.

## Môi trường và kết quả

| Hạng mục | Kết quả |
| --- | --- |
| Frontend | Vite tại `http://localhost:5173` |
| user-service | `http://localhost:8087`, health `200 UP` |
| ticketing-platform | `http://localhost:8091`, health tổng `503 DOWN`; liveness và readiness đều `200 UP` |
| Trình duyệt | Microsoft Edge headless; desktop 1440px, mobile 390px |
| Unit tests | 9/9 đạt: auth interceptor, chữ ký QR, khung giờ/sự kiện, tiền tệ, khách mời, ngày giờ |
| Hồi quy giao diện | 74/74 đạt; phần lớn mock hợp đồng API, có 1 test đăng nhập ADMIN thật |
| Check-in production/PWA | 5/5 đạt: online, offline/reload/sync, nhiều lượt vào, chữ ký sai, máy quét, camera lỗi |
| Tích hợp backend thật | 15/15 đạt, không mock API, không bỏ qua |
| Build / lint | Đạt |

Playwright kiểm tra bằng browser thật; kết quả mock không được coi là bằng chứng VNPay hoặc SMTP đã hoạt động. Không truy cập được Docker engine trong sandbox, nên chưa kiểm tra container logs hoặc xác định thành phần gây health tổng DOWN. API nghiệp vụ và phát hành/hủy vé qua Kafka đã hoạt động trong các bài test thực.

## 15 kịch bản với backend thật

1. Đăng nhập ADMIN qua form, tải lại, xem hồ sơ, quản trị người dùng và đăng xuất.
2. Đăng nhập USER, ẩn menu quản trị, chặn URL trực tiếp; server từ chối API quản trị bằng 403.
3. Đăng ký qua giao diện, kiểm tra mật khẩu xác nhận, tự đăng nhập, từ chối email đăng ký trùng bằng 409.
4. Cấp/thu hồi ORGANIZER và khóa/mở khóa tài khoản QA bằng màn 16.
5. ORGANIZER tạo sự kiện nháp ở màn 14, xuất bản qua màn 15.
6. Mở đủ 8 tab màn 15 bằng dữ liệu thật; tải được attendees.csv và payments.csv.
7. Tạo coupon và tắt coupon bằng giao diện.
8. ADMIN tạo thiết bị toàn cầu, xem key một lần, thu hồi thiết bị QA bằng màn 17.
9. QR vé mời do backend ký được chấp nhận tại màn 13; lần gửi thứ hai bị server trả DUPLICATE.
10. Đặt chỗ và thanh toán FREE qua API; vé chuyển ISSUED sau xử lý Kafka.
11. Màn 18 hiển thị lỗi tra cứu không tồn tại; USER gọi hoàn tiền bị 403.
12. Thanh toán MOCK 50.000 VND thành công; gửi lại cùng reservation trả cùng paymentRequestId, vé chuyển ISSUED.
13. Thanh toán MOCK thất bại; vé chuyển CANCELLED, quota được trả lại.
14. JWT sai bị 401; ORGANIZER xem/sửa sự kiện của người khác bị 404 và tạo thiết bị toàn cầu bị 403.
15. Trang chủ, hồ sơ và chi tiết sự kiện tải dữ liệu thật trên desktop/mobile, không tràn ngang.

Các bài thanh toán thật ở đây dùng **FREE/MOCK của backend local**, không phải giao dịch ngân hàng. Do chưa có luồng đặt vé trên frontend, các bài 10, 12, 13 đi qua API rồi kiểm tra trạng thái vé; chúng không chứng minh checkout UI hoạt động.

## Lỗi đã sửa trong đợt test

- Đăng xuất từ Header có thể bị chuyển tới `/login` do cạnh tranh điều hướng với PrivateRoute. Header nay gọi API thu hồi refresh token, xóa phiên cục bộ và tải trang công khai; vẫn thoát phiên khi API lỗi. Áp dụng điều hướng công khai tương tự cho nút đăng xuất trong Profile.
- Header tại trang sự kiện công khai từng hiện hồ sơ/đăng xuất dù chưa đăng nhập. Nay hiển thị Đăng nhập/Đăng ký và ẩn lịch sử đặt vé của khách.
- Đường dẫn chưa có route từng tạo trang trắng. Đã thêm trang Không tìm thấy trang với link quay lại; thay đổi này **không triển khai các màn còn thiếu**.
- Ảnh bìa dự phòng phụ thuộc ảnh mạng, có thể thành vùng trống khi ảnh không tải được. Đã dùng hình minh họa EventHub bằng SVG/CSS tại chỗ khi thiếu hoặc lỗi ảnh bìa.
- Unit test auth cũ mock nhầm ticketing client thay vì userClient; đã sửa để không gọi mạng thật ngoài ý muốn.
- Test server từ chối quyền màn 15 dùng profile không có roles nên bị chặn ngay tại route; đã bổ sung vai trò ORGANIZER để kiểm tra đúng phản hồi 403 từ server.
- Bộ test offline từng dùng lại một dev server ở cùng port, dẫn tới không có Service Worker. Runner nay dùng production preview tại port riêng 5178. Trong sandbox Windows, việc dừng test server có lúc bị treo; đã dừng các tiến trình test do đợt chạy này tạo và xác nhận cả 5 bài đạt, runner trả exit 0.

## Các phần còn thiếu / giới hạn

| Mức | Phát hiện | Ảnh hưởng |
| --- | --- | --- |
| Cao | Màn 8 chỉ hiển thị loại vé, giá và vé còn lại; không có hành động đặt/mua vé | Người mua chưa thể bắt đầu luồng thanh toán trên web |
| Cao | Chưa có route cho màn 9 checkout, màn 10 kết quả thanh toán, màn 11 vé của tôi và màn 12 QR chi tiết | Chưa hoàn thành luồng khách mua vé; backend vẫn có một số API tương ứng |
| Cao | Chưa có màn xác minh email, quên/đặt lại mật khẩu; link Quên mật khẩu hiện là `href="#"` | Link email `/verify-email` và `/reset-password` chưa xử lý token ở frontend |
| Cao | API tra cứu thanh toán chỉ cho chủ reservation và phụ thuộc online payment; chưa có lookup theo paymentId hoặc lookup toàn hệ thống cho ADMIN | Màn 18 chưa tra cứu được mọi giao dịch. Đã xử lý lỗi có thông báo; không vượt qua kiểm tra quyền |
| Vừa | `/history` có link trong Header nhưng chưa có trang | Nay hiển thị trang Không tìm thấy trang thay vì màn trắng |
| Vừa | Nút Đơn hàng của tôi, Sự kiện đã lưu, Thông báo, Cài đặt trong Profile không có xử lý | Bấm chưa đổi nội dung hoặc điều hướng; đã xác nhận qua browser |
| Vừa | Health tổng của ticketing-platform trả DOWN | Cần xem health chi tiết/container logs; chưa đủ bằng chứng kết luận lỗi do Kafka, SMTP hay thành phần khác |
| Vừa | Chi tiết sự kiện có một số nội dung chương trình, nghệ sĩ, điều khoản và nút chia sẻ/yêu thích tĩnh | Chưa thể xác nhận các nội dung này phản ánh dữ liệu thật; lưu sự kiện chưa có luồng hoạt động |

Chưa xác minh: hoàn tiền VNPay với merchant sandbox, IPN công khai, email đến hộp thư thật, camera vật lý, thiết bị quét vật lý, Safari/Firefox, kiểm thử tải/đồng thời nhiều thiết bị. Offline và camera lỗi đã được kiểm tra tự động; không đồng nghĩa camera vật lý đã được kiểm tra.

## Dữ liệu test và bằng chứng

- Dùng tài khoản email `qa-...@example.test`, sự kiện/thiết bị có tiền tố `QA-...`.
- Sau các lượt chạy cuối: khóa tài khoản QA, hủy sự kiện QA và thu hồi thiết bị QA; cleanup đều nhận 200. Giữ lịch sử test theo mô hình backend, không xóa dữ liệu hiện có của người dùng.
- File tạm chứa token/khóa dùng cho fixture đã được xóa sau suite. Không ghi credential hay token vào báo cáo này.
- Bằng chứng local: `frontend/tmp/live-results.json`, `frontend/tmp/regression-results.json`, `frontend/tmp/live-audit.json`, `frontend/tmp/route-audit.json`, ảnh `frontend/tmp/live-screen15.png`, `frontend/tmp/live-event-mobile.png`, `frontend/tmp/live-public-desktop.png`. Thư mục tmp bị Git ignore.
- Bộ test và runner đã được thêm ngoại lệ Git ignore để có thể review và chạy lại.

## Chạy lại

Chạy trong thư mục frontend, backend local cần hoạt động:

```powershell
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:regression:browser
npm.cmd run test:screen13:browser

$env:RUN_LIVE_TESTS = '1'
$env:AUTH_TEST_EMAIL = '<local admin email>'
$env:AUTH_TEST_PASSWORD = '<local admin password>'
npm.cmd run test:live:browser
```

Suite live chủ động tạo và kết thúc vòng đời dữ liệu QA. Chỉ chạy trên môi trường local/test. Đặt hai biến AUTH_TEST trước suite regression nếu muốn bài đăng nhập ADMIN thật cũng chạy; thiếu credential thì riêng bài đó được skip theo thiết kế.
