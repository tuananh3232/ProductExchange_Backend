# Phase 1 — PaymentAttempt và an toàn callback

Trạng thái implementation: COMPLETED.

- `PaymentAttempt` hỗ trợ PayOS, VNPay và wallet, unique idempotency/provider reference, callback history, verified payload hash và reconciliation state.
- Return/cancel URL chỉ đọc trạng thái. Payment/top-up chỉ được ghi từ webhook đã verify hoặc truy vấn server có xác thực.
- PayOS dùng counter bền vững; VNPay Return chỉ phục vụ UI, IPN là nguồn cập nhật giao dịch. VNPay refund dùng API provider; PayOS refund chuyển quy trình thủ công có evidence.
- Endpoint tương thích `/api/v1/payments/payos/create` và `/api/v1/payments/vnpay/create` chuyển đơn commerce mới sang engine chung; dữ liệu lịch sử không có checkout mới đi nhánh legacy.
- Test đã chứng minh callback giả, sai signature và replay không thể tạo paid/ledger trùng.

Rollout gate: sandbox E2E bằng credential merchant thật chưa chạy trong workspace này.
