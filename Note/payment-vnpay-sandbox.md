# Thanh Toán Đơn Hàng Bằng VNPay Sandbox

## Mục tiêu

- Hỗ trợ thanh toán cho đơn hàng đã hoàn tất xử lý nghiệp vụ.
- Tạm thời sử dụng VNPay Sandbox để test luồng thanh toán.
- Chưa kết nối môi trường production.

## Phạm vi tạm thời

- Chỉ áp dụng cho đơn hàng có trạng thái phù hợp để thanh toán.
- Thanh toán thông qua URL thanh toán của VNPay Sandbox.
- Hệ thống nhận callback để xác nhận kết quả thanh toán.
- Lưu trạng thái thanh toán của đơn hàng trong database.

## Luồng nghiệp vụ đề xuất

### 1. Tạo yêu cầu thanh toán

- Người dùng chọn đơn hàng cần thanh toán.
- Backend kiểm tra:
  - đơn hàng tồn tại
  - người dùng có quyền thao tác
  - đơn hàng đủ điều kiện thanh toán
  - số tiền thanh toán hợp lệ
- Backend tạo URL thanh toán VNPay Sandbox.
- Frontend chuyển người dùng sang cổng thanh toán.

### 2. VNPay xử lý giao dịch

- Người dùng nhập thông tin thanh toán trên cổng sandbox.
- VNPay trả kết quả về hệ thống qua:
  - `returnUrl`
  - `ipnUrl` nếu cần xác nhận server-to-server

### 3. Xác nhận thanh toán

- Backend verify chữ ký từ VNPay.
- Backend đối chiếu:
  - mã đơn hàng
  - số tiền
  - trạng thái giao dịch
  - chữ ký hợp lệ
- Nếu hợp lệ thì cập nhật đơn hàng đã thanh toán.

## Trạng thái nên lưu

- `unpaid`: chưa thanh toán.
- `pending_payment`: đang chờ thanh toán.
- `paid`: đã thanh toán thành công.
- `failed`: thanh toán thất bại.
- `cancelled`: thanh toán bị hủy.

## Dữ liệu nên lưu cho payment

- `orderId`
- `amount`
- `paymentMethod` = `vnpay`
- `paymentProvider` = `sandbox`
- `transactionRef`
- `bankCode`
- `responseCode`
- `paymentStatus`
- `paidAt`
- `rawCallbackData`

## API đề xuất

### POST /api/v1/payments/vnpay/create

- Tạo URL thanh toán VNPay Sandbox.
- Trả về `paymentUrl` để frontend redirect.

### GET /api/v1/payments/vnpay/return

- Nhận kết quả redirect sau thanh toán.
- Kiểm tra chữ ký và cập nhật trạng thái.

### POST /api/v1/payments/vnpay/ipn

- Nhận callback server-to-server.
- Dùng để xác nhận giao dịch đáng tin cậy hơn.

## Bảo mật cần có

- Không tin dữ liệu từ client nếu chưa verify chữ ký.
- Đối chiếu số tiền với dữ liệu trong database.
- Đảm bảo `orderId` khớp với giao dịch.
- Chỉ cho phép cập nhật trạng thái khi callback hợp lệ.

## Ghi chú triển khai

- Giai đoạn đầu dùng sandbox để test end-to-end.
- Sau khi ổn định mới chuyển sang môi trường thật.
- Nên tách riêng service payment để dễ mở rộng sang cổng khác sau này.
