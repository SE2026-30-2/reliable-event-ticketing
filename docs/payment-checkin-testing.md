# Hướng dẫn chạy test Payment và Check-in

## Yêu cầu

- JDK 21.
- Sử dụng Maven Wrapper có sẵn trong dự án.
- Các lệnh bên dưới dành cho Windows PowerShell.
- Chạy từ thư mục gốc repository.

## Chạy test Payment

```powershell
cd backend
.\mvnw.cmd "-Dtest=CreatePaymentRequestApplicationServiceTest,OnlinePaymentApplicationServiceTest,VnpayGatewayTest,VnpaySignerTest" test
```

Các lớp test được chọn:

- CreatePaymentRequestApplicationServiceTest
- OnlinePaymentApplicationServiceTest
- VnpayGatewayTest
- VnpaySignerTest

## Chạy test Check-in

Nếu đang ở thư mục backend, chạy:

```powershell
.\mvnw.cmd "-Dtest=DeviceApplicationServiceTest,SubmitCheckinApplicationServiceTest" test
```

Các lớp test được chọn:

- DeviceApplicationServiceTest
- SubmitCheckinApplicationServiceTest

## Chạy cả hai nhóm

Tại thư mục backend:

```powershell
.\mvnw.cmd "-Dtest=CreatePaymentRequestApplicationServiceTest,OnlinePaymentApplicationServiceTest,VnpayGatewayTest,VnpaySignerTest,DeviceApplicationServiceTest,SubmitCheckinApplicationServiceTest" test
```

## Đọc kết quả

- BUILD SUCCESS: lệnh Maven hoàn thành thành công.
- Tests run: số test đã chạy.
- Failures và Errors: cần bằng 0.
- Skipped: kiểm tra để biết có test bị bỏ qua không.

Báo cáo chi tiết nằm trong backend/target/surefire-reports.

## Kết quả kiểm tra

Ngày 01/11/2026, chạy lệnh kết hợp cả hai nhóm trên Windows
PowerShell nhận kết quả BUILD SUCCESS.

Kết quả này chỉ áp dụng cho các lớp test được chọn. Chưa xác nhận
thanh toán VNPay thực tế, gửi email, toàn bộ luồng giao diện hoặc
kiểm thử đồng thời CheckinRecordConcurrencyIT.