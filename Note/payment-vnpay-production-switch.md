# Chuyển Từ VNPay Sandbox Sang VNPay Thật

## Mục tiêu

- Hiện tại hệ thống dùng VNPay Sandbox để kiểm thử luồng thanh toán.
- Khi chuyển sang production, chỉ cần thay cấu hình và giữ nguyên luồng nghiệp vụ.
- Không cần sửa logic xử lý order/payment nếu đã tách đúng service.

## Phần sẽ thay thế

### 1. Biến môi trường

Thay các giá trị sandbox bằng thông tin thật từ VNPay:

- `VNPAY_SANDBOX_URL` -> URL production của VNPay.
- `VNPAY_TMN_CODE` -> mã merchant thật.
- `VNPAY_HASH_SECRET` -> secret key thật.
- `VNPAY_RETURN_URL` -> URL return của hệ thống production.
- `VNPAY_IPN_URL` -> URL IPN thật của hệ thống production.
- `VNPAY_VERSION`, `VNPAY_COMMAND`, `VNPAY_CURR_CODE`, `VNPAY_LOCALE`, `VNPAY_ORDER_TYPE` nếu VNPay yêu cầu giá trị khác.

### 2. Endpoint payment

Giữ nguyên các endpoint nội bộ:

- `POST /api/v1/payments/vnpay/create`
- `GET /api/v1/payments/vnpay/return`
- `POST /api/v1/payments/vnpay/ipn`

Chỉ thay URL đích VNPay ở biến môi trường, không cần đổi route backend.

### 3. Cấu hình xác minh chữ ký

- Giữ nguyên cách tạo và verify chữ ký HMAC.
- Chỉ đổi secret key sang key production.
- Vẫn phải đối chiếu số tiền và `orderId` với database.

### 4. Trạng thái đơn hàng

Luồng trạng thái vẫn giữ nguyên:

- `unpaid`
- `pending_payment`
- `paid`
- `failed`
- `cancelled`

Không cần thay đổi business logic, chỉ đổi nguồn thanh toán.

## Các bước chuyển đổi an toàn

1. Kiểm tra tài khoản merchant production đã được VNPay cấp.
2. Cấu hình đầy đủ biến môi trường production.
3. Thử tạo payment URL thật ở môi trường staging.
4. Kiểm tra `returnUrl` và `ipnUrl` có nhận callback đúng.
5. Đối chiếu chữ ký, số tiền, `transactionRef`.
6. Xác nhận order được cập nhật đúng sang `paid`.
7. Chạy test regression cho luồng order/payment.
8. Chỉ mở production khi staging chạy ổn định.

## Những điểm không nên thay đổi khi lên production

- Không tin dữ liệu từ client.
- Không cập nhật payment nếu chữ ký không hợp lệ.
- Không bỏ qua bước kiểm tra số tiền.
- Không cho phép trạng thái payment tự chuyển nếu callback chưa xác thực.

## Gợi ý triển khai thực tế

- Tách `.env.production` riêng.
- Dùng service payment hiện tại, chỉ thay config.
- Nếu sau này đổi cổng thanh toán khác, giữ interface service payment, thay provider implementation.

## Kết luận

- Sandbox là lớp test.
- Production chỉ là thay cấu hình và callback URL.
- Logic payment nên giữ ổn định để tránh phải sửa luồng order đã chạy ổn định.
