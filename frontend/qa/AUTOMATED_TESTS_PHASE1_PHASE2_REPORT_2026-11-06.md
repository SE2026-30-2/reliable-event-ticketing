# Báo cáo Bổ sung Kiểm thử Tự động (Phần 1 & Phần 2) — 06/11/2026

## 1. Tổng quan đợt triển khai

Đợt bổ sung kiểm thử tự động ngày 06/11/2026 tập trung giải quyết các khoảng trống kiểm thử trên ứng dụng Web (`frontend`), hoàn thiện 2 nhóm tính năng còn thiếu kịch bản tự động theo cấu trúc chuẩn của dự án:
* **Phần 1**: Các màn hình Xác thực (Auth) mở rộng: Quên mật khẩu, Đặt lại mật khẩu, Xác minh email và Tương tác nâng cao trên Hồ sơ cá nhân.
* **Phần 2**: Luồng Thanh toán VNPay (đếm ngược giữ chỗ, đối soát trạng thái, hủy, hoàn tiền) và Giả lập Phần cứng Soát vé Màn 13 (máy quét mã vạch USB/Bluetooth, quyền Camera, chế độ Ngoại tuyến & Đồng bộ).

---

## 2. Chi tiết các tệp kiểm thử đã xây dựng

### A. Unit Tests (Node Native Runner — `node:test`)
* **Tệp**: `tests/authExtended.test.mjs` (tích hợp vào `npm run test:unit`)
* **Nội dung kiểm tra**:
  - `userService.forgotPassword(email)`: Gửi request `POST /api/user/password/forgot` công khai, không đính kèm Bearer token.
  - `userService.resetPassword({ token, newPassword })`: Gửi request `POST /api/user/password/reset` công khai, kiểm tra payload.
  - `userService.verifyEmail(token)`: Gửi request `POST /api/user/email/verify` công khai.
  - `userService.resendVerificationEmail()`: Gửi request `POST /api/user/email/verify/resend` có xác thực Bearer token.
  - `userService.logout()`: Gửi request `POST /api/user/logout` mang theo `refreshToken` và Bearer token.
  - Bảo toàn thông điệp lỗi API theo cấu trúc Swagger (`message`, `details`).

### B. E2E Browser Tests (Playwright — `@playwright/test`)
1. **Auth mở rộng**: `tests/auth-extended.spec.mjs` (15 kịch bản, chạy qua `npm run test:auth-extended:browser`)
   - **Màn Quên mật khẩu (`/forgot-password`)**:
     - `FP-01`: Nhập email hợp lệ -> submit -> API nhận đúng payload -> reset form và hiển thị thông báo thành công.
     - `FP-02`: Server trả lỗi (email khóa/sai) -> hiển thị banner lỗi đỏ.
     - `FP-03`: Liên kết "Đăng nhập ngay" dẫn về `/login`.
   - **Màn Đặt lại mật khẩu (`/reset-password`)**:
     - `RP-01`: Submit thành công với token hợp lệ -> điều hướng về `/login`.
     - `RP-02`: Thiếu token trong URL -> Client chặn submit và cảnh báo ngay.
     - `RP-03`: Xác nhận mật khẩu không khớp -> Báo lỗi client.
     - `RP-04`: Token hết hạn từ backend -> Hiển thị thông báo lỗi từ server.
     - `RP-05`: Nút icon con mắt bật/tắt hiển thị mật khẩu.
   - **Màn Xác minh Email (`/verify-email`)**:
     - `VE-01`: Tự động gọi API xác thực khi mở link -> hiển thị màn hình Thành công và nút "Đăng nhập ngay".
     - `VE-02`: Link không có token -> hiển thị màn hình lỗi ngay lập tức.
     - `VE-03`: Token hết hạn từ backend -> hiển thị thông báo lỗi thất bại.
   - **Màn Hồ sơ cá nhân (`/profile`)**:
     - `PF-01`: Bấm gửi lại email xác minh -> gọi API resend và hiển thị thông báo.
     - `PF-02`: Tài khoản đã xác minh hiển thị badge xanh và vô hiệu hóa nút gửi lại.
     - `PF-03`: Fallback dữ liệu từ context khi API `/api/user/me` gặp lỗi mạng/server.
     - `PF-04`: Tài khoản ADMIN hiển thị shortcut "Quản trị hệ thống →" trỏ về `/admin`.

2. **Cổng thanh toán & Kết quả VNPay**: `tests/payment-vnpay.spec.mjs` (7 kịch bản, chạy qua `npm run test:payment:browser`)
   - `PAY-01`: Trạng thái trống khi mở `/payment-gateway` không có dữ liệu giao dịch.
   - `PAY-02`: Hiển thị định dạng tiền tệ VND, mã đơn hàng và đếm ngược thời gian giữ chỗ.
   - `PAY-03`: Polling tự động kiểm tra trạng thái thanh toán và chuyển hướng sang `/payment/result` khi giao dịch hoàn tất.
   - `PAY-04`: Nút "Tôi đã thanh toán thành công" hiển thị trạng thái chờ khi server vẫn đang ở `PENDING`.
   - `PAY-05`: Giao dịch `FAILED` hiển thị chính xác lý do hủy từ cổng thanh toán.
   - `PAY-06`: Giao dịch `REFUND_REQUIRED` hiển thị thông điệp chờ hoàn tiền.
   - `PAY-07`: Nút "Gửi lại email vé" tại trang kết quả gọi đúng API `/api/ticket/{id}/resend`.

3. **Giả lập Phần cứng & Thiết bị Soát vé Màn 13**: `tests/hardware-checkin.spec.mjs` (6 kịch bản, chạy qua `npm run test:hardware:browser`)
   - `HW-01`: Chế độ Máy quét (Wedge Mode) tự động nhận focus và giữ focus khi click ra ngoài.
   - `HW-02`: Máy quét mã vạch USB/Bluetooth gửi chuỗi kèm phím `Enter` tự động submit và gọi API soát vé.
   - `HW-03`: Xử lý tình huống người dùng từ chối cấp quyền camera (`NotAllowedError`).
   - `HW-04`: Xử lý tình huống thiết bị không có camera phần cứng (`NotFoundError`).
   - `HW-05`: Điều khiển bật/dừng camera cập nhật trạng thái kính ngắm.
   - `HW-06`: Chế độ Ngoại tuyến (Offline): Lưu vé cục bộ bằng chữ ký số RSA khi mất mạng, hiển thị "Chờ đồng bộ", và tự động đồng bộ khi có mạng lại qua `/api/checkin/batch`.

---

## 3. Lỗi mã nguồn (Bug) được phát hiện và khắc phục

* **Vị trí**: `src/services/axiosClient.js`
* **Mô tả lỗi**: Interceptor của `userClient` trước đây chỉ loại trừ header Authorization cho 2 endpoint `/api/user/login` và `/api/user/register`. Khi người dùng đã có token trong `localStorage`, các hàm công khai như `forgotPassword`, `resetPassword`, `verifyEmail` vô tình bị gửi kèm header `Authorization: Bearer <stale_token>`. Nghiêm trọng hơn, nếu backend trả mã 401 trên các trang này (ví dụ token reset hết hạn), interceptor sẽ tự động xóa sạch phiên làm việc của người dùng (`auth:unauthorized`).
* **Khắc phục**: Đã cập nhật interceptor để bỏ qua Authorization và không xóa session đối với các route auth công khai:
  ```js
  const isAuthRequest =
      config.skipAuth ||
      config.url?.includes('/api/user/login') ||
      config.url?.includes('/api/user/register') ||
      config.url?.includes('/api/user/password/forgot') ||
      config.url?.includes('/api/user/password/reset') ||
      (config.url?.includes('/api/user/email/verify') && !config.url?.includes('/api/user/email/verify/resend'));
  ```

---

## 4. Kết quả nghiệm thu thực tế

| Hạng mục kiểm tra | Lệnh thực thi | Kết quả | Ghi chú |
|---|---|---|---|
| **Unit Tests** | `npm run test:unit` | **12/12 PASS** | 0 fail, 0 skipped, thời gian ~17s |
| **Auth Extended E2E** | `npm run test:auth-extended:browser` | **15/15 PASS** | Playwright Headless Edge, 0 flaky |
| **Payment VNPay E2E** | `npm run test:payment:browser` | **7/7 PASS** | Playwright Headless Edge, 0 flaky |
| **Hardware Check-in E2E** | `npm run test:hardware:browser` | **6/6 PASS** | Playwright Headless Edge, 0 flaky |
| **Linting** | `npm run lint` | **PASS** | Exit code 0, 0 warning/error |
| **Production Build** | `npm run build` | **PASS** | Exit code 0, bundle thành công |
| **Git Diff Format** | `git diff --check` | **PASS** | Không có khoảng trắng thừa |

Toàn bộ 40 ca kiểm thử mới đã được tích hợp hoàn chỉnh vào hệ thống test tự động của dự án.
