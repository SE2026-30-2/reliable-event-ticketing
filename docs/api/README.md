# API Documentation

## Services Overview

### Identity Service (Port 8087)
Xử lý xác thực người dùng và quản lý JWT tokens.

**Base URL:** `http://localhost:8087`

### Ticketing Platform (Port 8091)
Quản lý sự kiện, vé, thanh toán và check-in.

**Base URL:** `http://localhost:8091`

## API Endpoints

Chi tiết đầy đủ về các endpoints sẽ được cập nhật khi implement từng module.

### Authentication (Identity Service)

- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `GET /.well-known/jwks.json` - JWKS endpoint cho JWT validation

### Events (Ticketing Platform)

- `GET /api/events` - Lấy danh sách sự kiện
- `GET /api/events/{id}` - Chi tiết sự kiện
- `POST /api/events` - Tạo sự kiện mới (Admin only)
- `PUT /api/events/{id}` - Cập nhật sự kiện (Admin only)
- `DELETE /api/events/{id}` - Xóa sự kiện (Admin only)

### Tickets (Ticketing Platform)

- `POST /api/tickets/purchase` - Mua vé
- `GET /api/tickets/my-tickets` - Lấy danh sách vé của user

### Payment (Ticketing Platform)

- `POST /api/payment/vnpay/create` - Tạo giao dịch VNPay
- `POST /api/payment/vnpay/ipn` - IPN callback từ VNPay

### Check-in (Ticketing Platform)

- `POST /api/checkin/validate` - Xác thực QR code

## Authentication

Hầu hết các endpoints yêu cầu JWT token trong header:

```
Authorization: Bearer <your-jwt-token>
```

Token có thể lấy từ endpoint `/api/auth/login`.
