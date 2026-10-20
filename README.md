# Hệ Thống Bán Vé Sự Kiện Tin Cậy

Nền tảng bán vé sự kiện dựa trên kiến trúc microservices, xây dựng với Spring Boot, React và Kafka.

## Kiến Trúc

### Backend Services

- **Identity Service** (Port 8087): Xác thực và phân quyền người dùng với JWT
- **Ticketing Platform** (Port 8091): Modular monolith xử lý:
  - Catalog: Quản lý sự kiện và vé
  - Payment: Xử lý thanh toán (Mock & VNPay)
  - Check-in: Xác thực mã QR
  - Notification: Gửi thông báo email

### Frontend Application

- **Frontend** (Port 5173): Giao diện người dùng React
  - React 19 + Vite
  - Tailwind CSS 4.3
  - React Router 7 cho routing
  - Axios cho HTTP requests
  - JWT decode cho authentication

## Yêu Cầu

- Docker & Docker Compose
- Java 21 (cho phát triển local)
- Node.js 18+ (cho phát triển frontend)

## Khởi Chạy Nhanh

1. Sao chép file môi trường:

```bash
cp .env.example .env
```

2. Chỉnh sửa `.env` và đặt mật khẩu database

3. Khởi động tất cả services:

```bash
docker compose up -d
```

4. Truy cập ứng dụng:

- Frontend: http://localhost:5173
- Identity Service: http://localhost:8087
- Ticketing Platform: http://localhost:8091
- Kafka UI: http://localhost:8086

## Phát Triển

### Backend Development

Xem thư mục `/docs` để biết chi tiết về:
- API endpoints
- Database schemas
- Kiến trúc hướng sự kiện
- Tích hợp thanh toán

### Frontend Development

1. Di chuyển vào thư mục frontend:
```bash
cd frontend
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Chạy development server:
```bash
npm run dev
```

4. Truy cập: http://localhost:5173

**Available Scripts:**
- `npm run dev` - Chạy development server
- `npm run build` - Build production
- `npm run preview` - Preview production build
- `npm run lint` - Chạy ESLint
- `npm run test:screen15:browser` - Chạy Playwright tests

**Tech Stack:**
- React 19 với hooks
- Vite 8 cho fast bundling
- Tailwind CSS 4.3 cho styling
- React Router 7 cho navigation
- Axios cho API calls
- JWT decode cho authentication

## Tổng Quan Services

### Hạ Tầng

- PostgreSQL databases (ports 5436, 5437)
- Apache Kafka + Zookeeper (ports 9092, 2181)
- Kafka UI (port 8086)

### Backend Services

Xây dựng với Spring Boot 3.3, sử dụng:

- Spring Data JPA
- Spring Security with OAuth2 Resource Server
- Spring Kafka
- Flyway migrations
- PostgreSQL 16
