# Màn 17 - Quản trị thiết bị

## Truy cập

- `/admin/devices`: cần đăng nhập với role `ADMIN`.
- `/admin/devices/preview`: dữ liệu minh họa và thao tác trong bộ nhớ; route chỉ được đăng ký khi Vite ở development. Key mẫu không dùng để check-in thật.
- Có liên kết từ Header và menu tài khoản của màn quản trị người dùng. ORGANIZER tiếp tục quản lý thiết bị thuộc sự kiện tại tab Thiết bị của màn 15.

Chạy `npm.cmd run dev` trong `frontend`. Backend đọc từ `VITE_TICKETING_SERVICE_URL` (mặc định `http://localhost:8091`); đăng nhập dùng `VITE_USER_SERVICE_URL` (mặc định `http://localhost:8087`).

## Hợp đồng API và nghiệp vụ

| Chức năng | API |
| --- | --- |
| Toàn bộ thiết bị | `GET /api/checkin/devices` không truyền eventId; chỉ ADMIN |
| Danh sách sự kiện để gán thiết bị | `GET /api/manage/events` |
| Tạo thiết bị | `POST /api/checkin/devices` với `{ label, eventId }`; toàn cầu gửi `eventId: null` |
| Thu hồi vĩnh viễn | `PATCH /api/checkin/devices/{deviceId}/revoke` |

Gửi Bearer token mới nhất từ localStorage cho từng request; giữ nguyên Axios error để phân biệt 401/403/404/429 và message từ server. Lỗi đọc danh sách không bị hiển thị thành không có thiết bị. Lỗi tải sự kiện giữ nguyên mã sự kiện trong bảng và chỉ chặn tạo thiết bị theo sự kiện; vẫn tạo được thiết bị toàn cầu. Request đọc được hủy khi rời trang.

Tìm kiếm tên/mã thiết bị/tên hoặc mã sự kiện không phân biệt dấu, hoa thường. Bộ lọc phạm vi, loại và trạng thái áp dụng trên toàn bộ danh sách trước khi phân trang. Số đếm tab dựa trên toàn bộ thiết bị, không thay đổi theo tìm kiếm.

Tạo thiết bị kiểm tra tên không chỉ có khoảng trắng và bắt buộc chọn sự kiện nếu cần. Form bị khóa khi gửi để tránh tạo lặp. Thành công mới thêm thiết bị vào danh sách và hiển thị API key trong hộp thoại riêng; key không được đưa vào list state, localStorage, sessionStorage, URL hoặc log. Clipboard chỉ được ghi khi bấm Sao chép. Đóng hộp thoại xóa key khỏi state; trang chi tiết không thể xem lại key. Không tự động retry POST vì API chưa có idempotency cho tạo thiết bị.

Thu hồi có hộp thoại xác nhận, khóa thao tác khi gửi và chỉ cập nhật danh sách sau phản hồi thành công. Thiết bị REVOKED không có nút thu hồi hay kích hoạt lại. Backend vẫn quyết định quyền thực tế và hiệu lực key.

## Khác biệt với ảnh thiết kế

- Chỉ có `ACTIVE` và `REVOKED` theo backend; không tự suy ra trạng thái offline từ `lastSeenAt`.
- Cột thời gian ghi rõ Hoạt động lần cuối, không gắn nhãn Cập nhật vì DTO không có updatedAt.
- Chưa có API đổi tên, gán lại sự kiện, xoay key hoặc thao tác hàng loạt nên không đưa các thao tác đó vào UI.
- Dùng tên thiết bị và UUID thật; không có trường phụ vị trí/cổng trong DTO.
- Sidebar chỉ liên kết các màn đã có. API key được nhận trong hộp thoại sau khi tạo.
- Response tạo chỉ có deviceId, label, eventId, apiKey; không tự điền createdAt hoặc lastSeenAt giả. Giá trị thời gian đầy đủ được đọc khi làm mới danh sách.

## Kiểm tra

Chạy từ `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test:screen17:browser
```

Bộ Playwright dùng Edge trên Windows, API giả lập và dữ liệu thử; kiểm tra phân quyền, token, tìm kiếm/lọc/phân trang, tạo key một lần, sao chép, không lưu key vào storage, chặn submit lặp, giữ form khi lỗi, xác nhận/thu hồi, lỗi tải dữ liệu và preview desktop/mobile. Ảnh kiểm tra ở `frontend/tmp/screen17-results/` được gitignore.

Build, lint và các kiểm thử màn 17 đã đạt khi triển khai. Đã xem ảnh desktop/mobile và hộp thoại tạo/nhận key. Chưa xác nhận API với backend và cơ sở dữ liệu thật đang chạy, hoặc dùng key mới quét vé thật ở màn 13.
