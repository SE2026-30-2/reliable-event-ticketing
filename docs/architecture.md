# Kiến Trúc Hệ Thống

## Tổng Quan

Hệ thống sử dụng kiến trúc microservices với event-driven architecture (Kafka).

```
┌─────────────────┐
│    Frontend     │
│   (React)       │
│   Port: 5173    │
└────────┬────────┘
         │
         │ HTTP/REST
         │
    ┌────┴──────────────────────┐
    │                           │
┌───▼──────────────┐  ┌────────▼───────────┐
│ Identity Service │  │ Ticketing Platform │
│   Port: 8087     │  │    Port: 8091      │
│                  │  │                    │
│ - Authentication │  │ - Catalog Module   │
│ - Authorization  │  │ - Payment Module   │
│ - JWT Provider   │  │ - Checkin Module   │
│                  │  │ - Notification     │
└─────────┬────────┘  └────────┬───────────┘
          │                    │
          │                    │
    ┌─────▼────────────────────▼─────┐
    │      Apache Kafka Broker       │
    │         Port: 9092             │
    └────────────┬───────────────────┘
                 │
    ┌────────────▼───────────────────┐
    │      PostgreSQL Databases      │
    │  - identity_service (5436)     │
    │  - ticketing_platform (5437)   │
    └────────────────────────────────┘
```

## Services

### Identity Service
- **Trách nhiệm:** Xác thực và phân quyền người dùng
- **Database:** PostgreSQL (identity_service)
- **Technology:** Spring Boot 3.3, Spring Security, JWT
- **Port:** 8087

### Ticketing Platform (Modular Monolith)
- **Trách nhiệm:** Quản lý toàn bộ nghiệp vụ bán vé
- **Database:** PostgreSQL (ticketing_platform)
- **Technology:** Spring Boot 3.3, Spring Data JPA, Kafka
- **Port:** 8091

#### Modules:
1. **Catalog Module**
   - Quản lý sự kiện (Event)
   - Quản lý vé (Ticket)
   - Inventory management

2. **Payment Module**
   - Mock payment provider
   - VNPay integration
   - Payment reconciliation

3. **Check-in Module**
   - QR code generation & validation
   - Check-in status tracking

4. **Notification Module**
   - Email notifications
   - Ticket delivery
   - Event reminders

## Event-Driven Architecture

Services giao tiếp thông qua Kafka events:

### Events
- `UserRegistered` - Khi user đăng ký
- `TicketPurchased` - Khi mua vé thành công
- `PaymentCompleted` - Khi thanh toán hoàn tất
- `TicketCheckedIn` - Khi check-in thành công

### Event Flow Example: Mua Vé

```
1. User mua vé → POST /api/tickets/purchase
2. Ticketing Platform tạo payment request
3. Payment completed → Publish "PaymentCompleted" event
4. Catalog module nhận event → Generate QR code
5. Notification module nhận event → Gửi email vé
```

## Database Schema

### Identity Service
- `users` - Thông tin người dùng
- `roles` - Vai trò (USER, ADMIN)
- `user_roles` - Bảng mapping

### Ticketing Platform
- `events` - Sự kiện
- `tickets` - Vé
- `payments` - Giao dịch thanh toán
- `checkins` - Lịch sử check-in

## Security

- **JWT Authentication:** Identity Service issue JWT tokens
- **JWKS Endpoint:** Ticketing Platform validate tokens qua JWKS
- **Role-Based Access:** ADMIN endpoints được bảo vệ bởi role check

## Monitoring & Observability

- **Actuator:** Health checks trên tất cả services
- **Kafka UI:** Monitor Kafka topics và consumers
- **Database:** Direct access qua localhost ports cho debugging
