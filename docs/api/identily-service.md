# GateKeep - user-service API Reference

Identity Provider của hệ thống: đăng ký/đăng nhập bằng email + mật khẩu, xác minh email, đặt lại mật khẩu, quản lý role (`USER`, `ORGANIZER`, `ADMIN`), và là nơi **duy nhất phát hành JWT (RS256)**. `ticketing-platform` chỉ **xác minh** JWT qua JWKS của service này, không chia sẻ secret.

Base URL `http://localhost:8087` (container nghe trực tiếp ở 8087). Swagger: `/swagger-ui.html`. DB: PostgreSQL `user_service` (host port 5436), migration `V1__init.sql` (cùng `db/dev-seed/V2__seed_admin.sql` khi bật seed dev).

**Xác thực**: 🔓 công khai · 🔐 cần `Authorization: Bearer <accessToken>` · 🔑 cần thêm `ROLE_ADMIN`.

## Endpoint

| Endpoint | Auth | Mô tả |
|---|---|---|
| `POST /api/user/register` | 🔓 (rate limit) | tạo tài khoản, mặc định role `USER`; `201` + `UserResponse` |
| `POST /api/user/login` | 🔓 | trả `LoginResponse` |
| `POST /api/user/refresh` | 🔓 | đổi refresh token lấy cặp token mới |
| `POST /api/user/logout` | 🔓 | thu hồi refresh token; `204` |
| `GET /api/user/me` | 🔐 | hồ sơ của chủ token (tra theo `sub` = email) |
| `POST /api/user/email/verify` | 🔓 | `{ token }` xác minh email; `204` |
| `POST /api/user/email/verify/resend` | 🔐 (rate limit) | gửi lại email xác minh; `204` |
| `POST /api/user/password/forgot` | 🔓 (rate limit) | `{ email }`; luôn `204`, kể cả khi email không tồn tại (không lộ email nào đã đăng ký) |
| `POST /api/user/password/reset` | 🔓 | `{ token, newPassword }`; `204` |
| `GET /api/user/admin/users` | 🔑 | danh sách phân trang (`?page&size`), `Page<UserResponse>` |
| `GET /api/user/admin/users/{id}` | 🔑 | chi tiết |
| `PATCH /api/user/admin/users/{id}/status` | 🔑 | `{ "status": "ACTIVE" \| "LOCKED" }` |
| `PATCH /api/user/admin/users/{id}/roles` | 🔑 | `{ "roles": ["USER","ORGANIZER"] }` — không rỗng, mỗi phần tử phải là `USER`, `ADMIN` hoặc `ORGANIZER` (khác → `400`). Có hiệu lực từ lần cấp token kế tiếp của người đó |
| `GET /.well-known/jwks.json` | 🔓 | JWK Set chứa public key RS256 (`kid = user-service-key-1`) |

### Request / response

| DTO | Trường |
|---|---|
| `RegisterRequest` | `email` (email hợp lệ), `password` (≥ 8 ký tự), `fullName` — đều bắt buộc |
| `LoginRequest` | `email`, `password` |
| `RefreshRequest` (refresh/logout) | `refreshToken` |
| `ResetPasswordRequest` | `token`, `newPassword` (≥ 8 ký tự) |
| `LoginResponse` | `accessToken`, `tokenType` (`Bearer`), `expiresIn` (giây, mặc định 900), `refreshToken`, `refreshExpiresIn` (giây, mặc định 604800) |
| `UserResponse` | `id`, `email`, `fullName`, `roles[]`, `status`, `failedLoginAttempts`, `emailVerified`, `createdAt` |

### Lỗi

| Status | Khi nào |
|---|---|
| 400 | validation, hoặc token xác minh/đặt lại không hợp lệ/hết hạn |
| 401 | sai email/mật khẩu, thiếu/sai JWT |
| 403 | không phải ADMIN |
| 404 | user không tồn tại (admin) |
| 409 | email đã đăng ký |
| 423 | tài khoản `LOCKED` |
| 429 | vượt rate limit (`register`, `password/forgot`, `email/verify/resend`) |

Body lỗi dạng `{ "message": "...", "details": [...] }`.

## JWT

- Ký bằng RS256, `kid = user-service-key-1`, `iss = user-service`.
- Claims: `sub` = **email** (không phải UUID), `roles` = danh sách tên role **không có tiền tố `ROLE_`** (service tiêu thụ tự thêm `ROLE_`), `email_verified` (boolean; `ticketing-platform` dùng để chặn mua khi chưa xác minh mà không phải gọi lại đây), `iat`, `exp`. Đổi role/xác minh email chỉ phản ánh vào token **mới** — dùng `POST /api/user/refresh`.
- TTL: access 900s, refresh 604800s (`security.jwt.access-token-ttl-seconds`, `refresh-token-ttl-seconds`).
- **Refresh token rotation**: mỗi lần `refresh` thu hồi token đã dùng và cấp cặp mới.
- Khóa ký là file PEM (`security.jwt.private-key-path`, mặc định `./keys/private_key.pem`; compose mount volume `user-service-keys`). Thiếu file thì tự sinh khóa mới — mọi JWT đã phát mất hiệu lực. Khóa cố định, không rotation.

## Khóa tài khoản và đặt lại mật khẩu

- Sai mật khẩu liên tiếp `security.account.max-failed-login-attempts` (mặc định 5) lần → `status = LOCKED`; đăng nhập trả `423` kể cả khi đúng mật khẩu.
- ADMIN mở khóa bằng `PATCH …/status`; hoặc tự mở khi **đặt lại mật khẩu thành công** (chứng minh quyền kiểm soát email). Đặt lại mật khẩu cũng thu hồi toàn bộ refresh token của user.
- Rate limit theo `(đường dẫn, IP trực tiếp)` — cửa sổ `security.rate-limit.auth-endpoints.window-seconds` (60s), tối đa `max-requests` (5). IP lấy từ `getRemoteAddr()`, **không** tin `X-Forwarded-For`; nếu đặt sau reverse proxy, mọi client sẽ dùng chung một bộ đếm.

## Sự kiện Kafka (producer)

Qua outbox (`outbox_events`, relay `@Scheduled`, at-least-once):

| Topic | Khi nào | Payload |
|---|---|---|
| `email-verification-requested` | đăng ký, hoặc resend | `{ eventId, email, fullName, token }` |
| `password-reset-requested` | forgot password (email tồn tại) | `{ eventId, email, fullName, token }` |

`token` là token **thô** dùng một lần (DB chỉ lưu hash); event là nơi duy nhất nó xuất hiện. Người tiêu thụ: module `notification` của `ticketing-platform` (xem [architecture.md](../architecture.md)). Tên topic là hợp đồng — không đổi nếu chưa phối hợp.

## CORS

`CorsConfig` cho phép origin `cors.allowed-origins` (mặc định `http://localhost:5173`), các method `GET/POST/PUT/PATCH/DELETE/OPTIONS`, mọi header. Cần vì không còn API Gateway đứng trước.

## Tài khoản seed (chỉ dev)

`db/dev-seed/V2__seed_admin.sql` tạo ADMIN `admin@commerceforge.local` / `Admin@12345`, nhưng file này **không nằm trong migration mặc định**: nó chỉ chạy khi `spring.flyway.locations` (env `SPRING_FLYWAY_LOCATIONS`) có thêm `classpath:db/dev-seed`. Môi trường thật tạo ADMIN đầu tiên theo hướng dẫn trong [setup.md](../setup.md#tạo-admin-đầu-tiên-môi-trường-thật). Mật khẩu DB (`SPRING_DATASOURCE_PASSWORD`) là bắt buộc, không có mặc định.

## Lưu ý bảo mật

- Actuator mặc định chỉ mở `health,info` (`MANAGEMENT_ENDPOINTS_EXPOSURE`); `anyRequest().permitAll()` cho các đường dẫn ngoài `/api/user/**`.
- Rate limit nằm trong bộ nhớ và theo `getRemoteAddr()`.
