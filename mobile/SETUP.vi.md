# React Native với Expo trong VS Code

Ứng dụng EventPass viết bằng TypeScript, React Native và Expo Router, kết nối API của hệ thống bán vé.

## Mở trong VS Code

Từ thư mục gốc của repository:

```powershell
code .\mobile
```

Môi trường cần Node.js LTS và extension chính thức `expo.vscode-expo-tools`.
Sau khi cập nhật Node.js, mở lại terminal để nhận phiên bản mới.
Khi tải lại mã nguồn trên máy khác, chạy `npm.cmd ci` trong thư mục `mobile`.

## Chạy trên điện thoại

1. Cài [Expo Go](https://expo.dev/go) tương thích Expo SDK trong `package.json`.
2. Kết nối máy tính và điện thoại cùng mạng Wi-Fi.
3. Mở terminal trong thư mục `mobile` và chạy:

   ```powershell
   npm.cmd run start -- --go
   ```

4. Quét mã QR bằng Expo Go trên Android hoặc Camera trên iPhone.
   Nếu Expo Go yêu cầu đăng nhập, đăng nhập cùng tài khoản trên điện thoại
   và CLI bằng `npx.cmd expo login`.
5. Các màn hình nằm trong `src/app`; điều hướng chính nằm trong `src/app/(tabs)`.

### Kết nối API

Backend Identity cần truy cập được ở cổng 8087 và Ticketing ở cổng 8091.
Mặc định ứng dụng dùng hostname của máy chạy Expo. Nếu cần chỉ định địa chỉ,
sao chép `.env.example` thành `.env.local`, rồi sửa IP LAN của máy backend.
Không dùng `localhost` khi chạy trên điện thoại thật. Android emulator có thể
dùng `10.0.2.2`. Cho phép hai cổng API qua Windows Firewall trên mạng đang dùng.
Khởi động lại Expo sau khi sửa cấu hình. Tunnel của Expo không chuyển tiếp API.

Dừng server bằng `Ctrl+C`. Nếu mạng chặn kết nối LAN, có thể thử
`npx.cmd expo start --go --tunnel`; CLI có thể yêu cầu tải thêm công cụ tunnel.

## Chạy và kiểm tra trong VS Code

Chọn **Terminal > Run Task** rồi chọn một tác vụ:

- `Expo: Start (Expo Go)` — hiện mã QR để mở trên điện thoại.
- `Expo: Web` — xem bản web trên trình duyệt.
- `Expo: Doctor` — kiểm tra cấu hình và phiên bản các gói.
- `TypeScript: Check` — kiểm tra kiểu dữ liệu.

Các tác vụ giả định thư mục `mobile` đang được mở làm workspace trong VS Code.
Khi server chạy, nhấn `j` trong terminal để mở React Native DevTools
sau khi ứng dụng đã kết nối.

## Android emulator và iOS

Expo Go trên điện thoại thật không cần Android Studio, JDK hoặc Android SDK.
Để dùng Android emulator hoặc build Android native trên máy, cần cài thêm
Android Studio, Android SDK và thiết bị ảo theo
[hướng dẫn Expo](https://docs.expo.dev/workflow/android-studio-emulator/).
Sau đó chạy `npm.cmd run android`.

iOS Simulator và build iOS cục bộ cần macOS với Xcode. Trên Windows có thể
phát triển và thử ứng dụng bằng Expo Go trên iPhone.

## Tài liệu

- [Bắt đầu với Expo](https://docs.expo.dev/get-started/create-a-project/)
- [Chạy ứng dụng](https://docs.expo.dev/get-started/start-developing/)

Xem [README.md](./README.md) để biết danh sách chức năng đã chuyển, phần chưa hỗ trợ và lệnh kiểm thử.
