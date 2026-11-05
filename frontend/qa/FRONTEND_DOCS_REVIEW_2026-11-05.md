# Review frontend theo tài liệu — 05/11/2026

## Kết quả chính

Phát hiện **11 vấn đề: 6 P1 và 5 P2**, được kiểm chứng bằng **13 kịch bản tái hiện trên production build**, API giả lập theo hợp đồng backend. P1 cần ưu tiên vì có thể làm sai kết quả thanh toán hoặc chặn luồng mua/sử dụng vé bình thường; P2 ảnh hưởng chức năng trong các điều kiện cụ thể.

Đây là kết quả review ban đầu. Sau yêu cầu tiếp theo, 11 phát hiện F01–F11 đã được xử lý trong frontend; xem [báo cáo sửa lỗi và kiểm chứng](FRONTEND_DOCS_FIXES_2026-11-05.md). Các thay đổi sửa màn 13/14/15 từ lượt trước và thay đổi cục bộ của người dùng được giữ nguyên.

## Tài liệu và cách đối chiếu

- `docs/business-flows.md`: luồng mua vé, VNPay, vé nhiều lượt/gói, danh sách chờ, quyền sở hữu và đối soát offline.
- `docs/api/ticketing-platform.md`: request/response, phân trang vé, định danh danh sách chờ, tiền cents, QR và trạng thái payment.
- `docs/api/user-service.md`: profile, access/refresh token, xác minh email và logout.
- `docs/architecture.md`: hai dịch vụ, JWT/JWKS và xử lý bất đồng bộ.
- `docs/frontend-rebuild-review.md`, `docs/screen-14-frontend.md`, `docs/screens-13-15-completion.md`: lịch sử triển khai, yêu cầu và giới hạn kiểm thử.
- Đối chiếu thêm `ReserveTicketRequest`, `ReservationResponse`, `WaitlistController`, thông báo email `handleWaitlistOffered` và cấu hình backend/`.env.example`.

Một số tài liệu cũ đã lỗi thời: đường dẫn `backend/user-service`, mô tả frontend chỉ có login/register/home, hoặc màn 14 chưa có danh mục/upload/analytics. Không dùng những mô tả lịch sử đó để kết luận tính năng hiện tại còn thiếu. DTO/controller và tài liệu hoàn thiện mới hơn được dùng để kiểm tra những trường hợp này.

## Phát hiện

### F01 — [P1] Trang kết quả thanh toán có thể báo thành công mà backend chưa xác nhận

**Vị trí:** `src/pages/PaymentPage/PaymentResult.jsx:25`, `:45`, `:62`, `:133–174`.

- Không có `location.state` hoặc mã giao dịch thì mặc định `success`.
- Khi đối soát trả `PENDING`/`FAILED`, query `vnp_ResponseCode=00` vẫn khiến trang hiển thị thành công. Ngay cả khi đối soát lỗi, catch cũng dùng query để kết luận.
- Các nút “Mô phỏng UI” vẫn có mặt trong production và tự đổi trạng thái kết quả.

**Đã tái hiện:** mở `/payment-result` trực tiếp không gọi API thanh toán nhưng thấy “Thanh toán thành công!”. Mở `/payment-result?vnp_TxnRef=review-txn&vnp_ResponseCode=00`, mock đối soát trả `PENDING`, vẫn thấy thành công.

**Ảnh hưởng:** người mua được thông báo đã trả tiền/vé đã xác nhận khi giao dịch chưa hoàn tất. Đây là sai lệch UI; không khẳng định backend phát hành vé chỉ vì sửa URL.

**Căn cứ:** `docs/business-flows.md`, phần VNPay; API sync có thể trả `PENDING` khi chưa xác định được kết quả (`docs/api/ticketing-platform.md:147–148`).

**Hướng sửa:** lấy trạng thái backend làm nguồn xác nhận; có trạng thái pending/không xác định/không có giao dịch; tách mô phỏng khỏi trang production.

### F02 — [P1] QR trên Vé của tôi và Kết quả thanh toán là hình SVG cố định

**Vị trí:** `src/pages/MyTicketsPage/MyTickets.jsx:310–322`; `src/pages/PaymentPage/PaymentResult.jsx:295–307`.

Các ô được trình bày như vé điện tử chỉ vẽ một tập hình chữ nhật cố định, không mã hóa `ticket.qrPayload` do backend ký.

**Đã tái hiện:** API trả hai vé `ISSUED` có ticket ID và `qrPayload` khác nhau; hai SVG QR hiển thị có `outerHTML` giống hệt nhau. Kiểm tra mã nguồn xác nhận SVG không dùng payload.

**Ảnh hưởng:** người mua không thể dùng mã hiển thị trên các trang này để soát vé. QR trong email là luồng riêng, chưa kiểm chứng ở lần review này.

**Căn cứ:** `docs/api/ticketing-platform.md:78`; check-in nhận chuỗi QR ký từ hệ thống, không nhận hình minh họa hoặc mã reservation.

**Hướng sửa:** sinh QR từ payload thật của vé `ISSUED`; không trình bày QR khả dụng cho vé chưa phát hành hoặc đã bị vô hiệu.

### F03 — [P1] Thông tin người nhận điền sẵn bị gửi thành null khi đặt vé

**Vị trí:** `src/pages/EventDetailPage/EventDetail.jsx:29–32`, `:197–201`.

Ô nhập hiển thị `formFullName`/`formEmail` lấy từ profile khi state còn null; request đặt chỗ lại gửi `fullName`/`email` thô. Người dùng thấy thông tin đầy đủ và nhấn đặt vé mà không sửa ô thì cả hai trường vẫn null.

**Đã tái hiện:** profile đã xác minh có tên/email, hai ô hiện đúng dữ liệu; POST reservations gửi `{ holderName: null, holderEmail: null }`.

**Ảnh hưởng:** thao tác đặt vé mặc định bị backend từ chối 400. `ReserveTicketRequest` đánh dấu cả hai trường `@NotBlank`.

**Hướng sửa:** xác thực và gửi cùng dữ liệu người dùng đang thấy trong form, trim trước khi gửi.

### F04 — [P1] Checkout không đọc reservation từ URL, làm hỏng liên kết thanh toán trong email

**Vị trí:** `src/pages/CheckoutPage/Checkout.jsx:47–52`, `:73`, `:171–190`.

Tham số `/checkout/:id` được coi là event ID; reservation ID chỉ lấy từ `location.state`. Khi mở link email `/checkout/{reservationId}`, state không tồn tại và trang báo không tìm thấy đơn.

**Đã tái hiện:** đăng nhập hợp lệ rồi mở trực tiếp `/checkout/22222222-2222-4222-8222-222222222222` → “Không tìm thấy đơn đặt chỗ”.

**Căn cứ:** `TicketNotificationApplicationService.java:96` thực sự tạo link `/checkout/{reservationId}`; `docs/api/ticketing-platform.md:110` và `docs/frontend-rebuild-review.md`, mục route checkout.

**Hướng sửa:** thống nhất URL theo reservation ID và khôi phục reservation từ dữ liệu backend của chính người mua. Đối chiếu endpoint hiện có trước khi bổ sung API; không tự thay hợp đồng giữa các dịch vụ.

### F05 — [P1] Bước chuyển sang checkout bỏ mất vé, tổng tiền và hạn giữ chỗ do server trả về

**Vị trí:** `src/pages/EventDetailPage/EventDetail.jsx:204–232`; bên nhận tại `src/pages/CheckoutPage/Checkout.jsx:53–65`, `:127–130`.

Sau POST reservations, frontend giữ reservation ID nhưng không truyền `reservation.tickets`, `totalCents` hoặc `discountCents`. Checkout vì thế nhận mảng vé rỗng, không có `reservationExpiresAt`, dùng tổng từ quote phía trước và bộ đếm mặc định 600 giây.

**Đã tái hiện:** response đặt chỗ có tổng 80.000đ, giảm 20.000đ và hạn giữ chỗ 2 phút; history state không có tickets/amountCents/discountCents, vẫn mang tổng quote 100.000đ; checkout hiện bộ đếm 10:00.

**Ảnh hưởng:** sai thông tin số tiền/thời hạn đã chốt; khi payment hoàn tất, `pollUntilIssued([])` trả ngay vì `every()` trên mảng rỗng, nên không theo dõi việc phát hành vé thực tế. Server vẫn tự tính tiền; không khẳng định backend thu số tiền do UI tự tính.

**Căn cứ:** `ReservationResponse` và `docs/api/ticketing-platform.md:66–72`, `:139`.

**Hướng sửa:** dùng nguyên dữ liệu reservation được xác nhận cho checkout, khởi tạo countdown từ expiry thật và poll đúng ticket ID cho đến khi phát hành hoặc kết quả chưa xác định.

### F06 — [P1] Route nhận kết quả VNPay không khớp địa chỉ trong tài liệu cấu hình

**Vị trí:** `src/routes/AppRoutes.jsx:95`.

Frontend chỉ đăng ký `/payment-result`, trong khi `.env.example:24` hướng dẫn `VNPAY_RETURN_URL` là `/payment/result`. Tài liệu luồng VNPay cũng dùng đường dẫn này.

**Đã tái hiện:** mở `/payment/result?vnp_TxnRef=review-txn&vnp_ResponseCode=00` → “Không tìm thấy trang”.

**Ảnh hưởng:** triển khai theo ví dụ cấu hình sẽ đưa người mua về trang 404 sau khi trả tiền. Không khẳng định `.env` riêng của người dùng hiện đang đặt URL nào; không đọc `.env` để review.

**Hướng sửa:** hỗ trợ route tương thích và thống nhất các liên kết trong tài liệu/cấu hình; đồng thời áp dụng F01 khi xử lý callback.

### F07 — [P2] API từ chối coupon nhưng frontend tự tạo mức giảm 10%

**Vị trí:** `src/pages/EventDetailPage/EventDetail.jsx:117–129`.

Mọi lỗi báo giá chuyển sang tính giá client. Chỉ cần `couponCode` không rỗng, frontend tự giảm 10%, kể cả API đã trả 400 vì mã sai/hết hạn.

**Đã tái hiện:** API quote từ chối mã `INVALID`; UI hiện “Giảm: -10.000đ” và giá 90.000đ cho vé 100.000đ.

**Ảnh hưởng:** báo giá sai và khiến người mua tưởng coupon hợp lệ; request đặt chỗ vẫn có thể bị từ chối hoặc thu tiền theo quy tắc backend.

**Căn cứ:** `docs/api/ticketing-platform.md:56–58` quy định lỗi coupon có lý do cụ thể và giá được tính cùng cơ chế backend.

**Hướng sửa:** hiển thị lỗi quote/coupon, không tự suy diễn giảm giá; chỉ tiếp tục khi có báo giá hợp lệ cho đúng loại vé, số lượng và coupon hiện tại.

### F08 — [P2] Countdown khiến polling trạng thái VNPay không chạy

**Vị trí:** `src/pages/PaymentPage/PaymentGateway.jsx:33–37`, `:72–74`.

Polling đặt interval 3 giây, nhưng effect phụ thuộc `timeLeft` thay đổi mỗi giây. Mỗi lần đếm ngược cập nhật lại dọn interval trước khi nó kịp chạy.

**Đã tái hiện:** mở gateway có txnRef/paymentUrl; timer từ 15:00 xuống 14:56 nhưng không có request sync nào.

**Ảnh hưởng:** trang không tự nhận kết quả; người mua phải nhấn nút xác nhận thủ công. Nếu bỏ qua nút đó, màn chờ có thể kéo dài đến hết countdown.

**Hướng sửa:** tách vòng polling khỏi giá trị countdown thay đổi từng giây, dừng theo trạng thái giao dịch và hủy request/timer khi rời trang.

### F09 — [P2] Danh sách chờ dùng sai tên trường định danh của API

**Vị trí:** `src/pages/MyTicketsPage/MyTickets.jsx:113`, `:500`, `:533`, `:546`, `:552`.

API trả `entryId`, `ticketTypeId`, `reservationId`, không trả `id`, `waitlistId` hoặc `eventId`. Frontend lại dùng những trường không có đó cho key, hủy và thanh toán.

**Đã tái hiện:**

- Entry WAITING đúng DTO → “Rời danh sách” gửi DELETE `/api/waitlist/undefined`.
- Entry OFFERED có reservation ID → “Thanh toán ngay” mở `/checkout/undefined` và báo không tìm thấy đơn.

**Ảnh hưởng:** không thể rời hàng đợi/từ chối offer hoặc thanh toán qua thao tác tại trang này.

**Căn cứ:** `WaitlistController.WaitlistEntryResponse`; `docs/api/ticketing-platform.md:108–110`.

**Hướng sửa:** dùng `entryId` nhất quán, lọc state theo cùng trường và đi checkout bằng `reservationId`. Phần tải đơn cần sửa cùng F04.

### F10 — [P2] Vé của tôi chỉ hiển thị trang đầu tiên từ API

**Vị trí:** `src/services/ticketService.js:5–6`; `src/pages/MyTicketsPage/MyTickets.jsx:43–49`, `:184–188`.

Client gọi một lần GET `/api/my/tickets` không có page/size, lấy `content` rồi tự phân trang 4 vé từ danh sách đó. `totalElements` và `totalPages` của API bị bỏ qua.

**Đã tái hiện:** API có 25 vé, trang đầu 20 vé → UI chỉ có 5 trang nhỏ, dừng ở Holder 19; không có trang 6 hoặc request lấy 5 vé còn lại.

**Căn cứ:** `docs/api/ticketing-platform.md:86–88`, endpoint trả Spring Page với mặc định size 20.

**Hướng sửa:** điều khiển phân trang API và tổng số vé đúng theo response, hoặc tải các trang có chủ đích trước khi phân trang client.

### F11 — [P2] Nút danh mục trang chủ chỉ đổi màu, không lọc sự kiện

**Vị trí:** `src/pages/HomePage/Home.jsx:151–180`, `:203`.

Nút danh mục cập nhật `selectedCategory` nhưng danh sách vẫn render thẳng `events.map()`, request cũng không thay đổi theo danh mục.

**Đã tái hiện:** API có một MUSIC và một SPORTS; nhấn “Âm nhạc” vẫn thấy sự kiện SPORTS.

**Hướng sửa:** áp dụng bộ lọc vào danh sách đã tải theo trường `category` thật; không chỉ thay trạng thái nút. Không cần thay API để lọc tập dữ liệu hiện tại.

## Khoảng trống bổ sung từ kiểm tra mã nguồn

- Cơ chế refresh session trong `docs/frontend-rebuild-review.md` vẫn chưa được triển khai đầy đủ: AuthContext chỉ khôi phục localStorage; `authService` không có refresh; client chung xóa cả refresh token ngay khi gặp 401. Các client quản trị riêng lại giữ phiên và chỉ hiển thị lỗi. Vì access token mặc định hết hạn sau 900 giây, hành vi hết phiên giữa các khu vực chưa thống nhất. Đây là ghi nhận tĩnh, chưa mô phỏng hết hạn JWT/backend thật trong đợt này.
- Client chung chuyển AxiosError thành `new Error(message)` (`src/services/axiosClient.js:56`), làm mất status và headers mà một số trang đang cố đọc qua `error.response`. Cần giữ cấu trúc lỗi khi triển khai xử lý 403/409/429 và `Retry-After`.
- Bộ browser regression hiện có chủ yếu bao phủ xác thực, điều hướng và màn 13–18; test mở trang chi tiết không đi tiếp hết reservation → payment → phát hành → QR. Các lỗi mua vé kể trên vì thế chưa được bộ regression trước đây phát hiện.

## Kiểm chứng lần này

- `npm run lint`: exit code 0.
- `npm run test:unit`: 10/10 đạt, exit code 0.
- `npm run build`: exit code 0; còn cảnh báo bundle chính khoảng 583 kB sau minify.
- 13 ca tái hiện riêng trên production build bằng Playwright/Edge: tất cả đã xác nhận hành vi lỗi như mô tả. Chúng là **kiểm chứng lỗi tồn tại**, không phải 13 ca chứng minh sản phẩm đúng.
- Lượt đầu có 10 ca tái hiện đạt, 1 ca không tìm thấy nút vì selector sai chữ hoa/thường. Đã sửa selector test; chạy lại 3 ca danh sách chờ/danh mục, exit code 0. Không thay mã ứng dụng.
- Script/config/fixture ở `frontend/tmp/docs-review.spec.mjs`, `docs-review.config.mjs`, `run-docs-review.mjs`; thư mục tạm bị Git bỏ qua. Server kiểm thử đã đóng, runner không treo.
- `git diff --check`: đạt.

Chưa chạy backend thực, Kafka phát hành vé, VNPay thật hoặc camera/thiết bị vật lý. Các request mock giữ dạng DTO backend đã đối chiếu; những kết luận về UI/request/polling được quan sát trực tiếp trên trình duyệt. Không chỉnh `.env`, không tạo giao dịch thật và không thay đổi database.

## Thứ tự xử lý đề nghị

1. F01/F06: xác nhận kết quả VNPay và route callback.
2. F03/F04/F05: khép kín luồng đặt chỗ → checkout, dùng đúng reservation và dữ liệu server.
3. F02: QR thật theo từng vé đã phát hành.
4. F07/F08/F09/F10/F11: báo giá, polling, danh sách chờ, phân trang và danh mục.
5. Bổ sung kiểm thử hồi quy luồng người mua đầy đủ, gồm pending/thất bại/miễn phí, mở trực tiếp link email, bundle và phát hành chậm.
