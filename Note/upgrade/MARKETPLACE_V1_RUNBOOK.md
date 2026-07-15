# Marketplace MVP API v1 — vận hành và cutover

## 1. Điều kiện bắt buộc

- MongoDB Atlas hoặc replica set; không bật money flow trên standalone MongoDB.
- Sao lưu database và thử phục hồi trước khi chạy migration `--apply`.
- Cấu hình JWT, CORS và credential đúng với các feature flag được bật.
- Tiền VND là số nguyên. Không truyền hoặc lưu số thập phân.

## 2. Feature flag

Các flag nguy hiểm mặc định tắt: `COMMERCE_ENABLED`, `PAYOS_PAYMENTS_ENABLED`,
`VNPAY_PAYMENTS_ENABLED`, `WALLET_PAYMENTS_ENABLED`, `WITHDRAWALS_ENABLED`,
`EXCHANGE_ENABLED`, `RENTAL_ENABLED`, `SUBSCRIPTION_PAYMENT_ENABLED`,
`ROOM_VISUALIZER_ENABLED`. Đây là feature generation mới nhưng vẫn dùng contract
`/api/v1`; không mở thêm version API. Production phải đặt `REQUIRE_MONGO_TRANSACTIONS=true`.

Thứ tự bật đề xuất: commerce mới nội bộ → wallet sandbox → PayOS sandbox → pilot →
production. Withdrawal chỉ bật sau khi `/api/v1/admin/reconciliation/run` trả
`ledgerDriftCount=0` và `paymentChainIssueCount=0` liên tục.

## 3. Migration

```bash
npm run migrate:marketplace-v1 -- --dry-run
npm run migrate:marketplace-v1 -- --apply
```

Migration có checkpoint `marketplace-v1`, thống kê product/order/payment/account và
không replay giao dịch lịch sử. Nó tạo default SKU, item snapshot, legacy
PaymentAttempt và opening account balance. Bản ghi thiếu dữ liệu được đưa vào số
liệu `manualReconciliation`; phải xử lý trước cutover.

Quy trình cutover: tắt money writes v1 → backup → dry-run → apply → đối soát → admin
phê duyệt → bật commerce mới trên API v1. Không chạy `--apply` lần hai và không sửa checkpoint
thủ công.

## 4. Payment, refund và incident

- Return/cancel URL chỉ để hiển thị; không dùng làm bằng chứng thanh toán.
- PayOS chỉ capture từ webhook qua verify. Replay dùng cùng command key nên không
  tạo ledger hoặc consume stock lần hai.
- PayOS refund ở trạng thái `manual_required`; admin phải nhập transaction ID,
  bank reference và thời gian chuyển tiền.
- Wallet refund chạy tự động trong Mongo transaction.
- Khi provider timeout: giữ attempt ở trạng thái hiện tại, query provider hoặc đối
  soát; không tự đánh dấu paid.
- Khi reconciliation có issue: tắt withdrawal, giữ escrow, ghi nhận incident và
  chỉ resolve sau khi đối chiếu provider statement.
- Khi phát hiện ledger drift: tắt toàn bộ money write flags; không sửa balance trực
  tiếp. Tạo bút toán điều chỉnh được duyệt và lưu audit trail.

## 5. Order state machine

`payment_pending → paid_held → seller_confirmed → processing → shipped → completed`.
Buyer mở `return_requested` hoặc `disputed` để giữ escrow. Seller không có endpoint
đưa đơn thẳng sang `completed`; settlement chỉ chạy khi buyer xác nhận nhận hàng.

## 6. API v1 chính

- `POST /api/v1/checkouts`
- `POST /api/v1/payments`, `GET /api/v1/payments/:id`
- `POST /api/v1/payments/payos/webhook`
- `GET /api/v1/orders`, `GET /api/v1/orders/:id`
- `POST /api/v1/orders/:id/confirm|process|ship|confirm-received|cancel`
- `POST /api/v1/orders/:id/cases`
- `PATCH /api/v1/admin/order-cases/:id/resolve`
- `POST /api/v1/admin/refunds/:id/process`
- `PATCH /api/v1/admin/refunds/:id/confirm-manual`
- `GET /api/v1/admin/reconciliation/issues`

Mọi command tạo checkout, payment và resolve case cần `Idempotency-Key`.
