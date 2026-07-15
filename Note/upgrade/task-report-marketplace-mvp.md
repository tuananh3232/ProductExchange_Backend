# TASK REPORT

## 1. Tóm tắt đã thực hiện

* Đã hoàn thành:
  * Giữ toàn bộ API công khai ở `/api/v1`; commerce contract mới không sử dụng `/api/v2`.
  * Hoàn thành baseline fail-fast, feature flag, Mongo transaction gate, structured log, correlation ID, readiness, JSON 404, error middleware và CI replica-set.
  * Hoàn thành `PaymentAttempt` cho PayOS/VNPay/wallet; Return URL chỉ đọc, webhook/IPN verify, replay idempotent, counter bền vững và provider adapter/refund workflow.
  * Hoàn thành SKU/variant, inventory reservation atomic, expiry job lease và chống oversell.
  * Hoàn thành checkout nhiều merchant, order item snapshot, shipping snapshot, cart update và rollback trong cùng transaction.
  * Hoàn thành double-entry ledger, order/exchange/rental escrow, fee snapshot, wallet/top-up/refund/settlement/withdrawal accounting và reconciliation queue.
  * Hoàn thành fulfillment state machine, shipment, confirm-received, auto-complete, return/dispute, refund đầy đủ và hoàn tiền một phần.
  * Hoàn thành withdrawal seller/shop với pending balance, conditional transition, transfer evidence, maker-checker, bank reference unique và masked list.
  * Hoàn thành KYC private access/audit/retention và upload security.
  * Hoàn thành hardening exchange, rental, subscription và room visualizer; scheduler dùng Mongo job lease.
  * Hoàn thành migration/runbook/OpenAPI cho marketplace v1 và compatibility adapter cho dữ liệu lịch sử.

* Các file chính đã tạo hoặc chỉnh sửa:
  * `src/routes/index.js`
  * `src/routes/checkout/checkout.route.js`
  * `src/routes/payment/payment.route.js`
  * `src/routes/commerce.swagger.docs.js`
  * `src/services/checkout/checkout.service.js`
  * `src/services/payment/payment-attempt.service.js`
  * `src/services/accounting/accounting.service.js`
  * `src/services/accounting/reconciliation.service.js`
  * `src/services/order/commerce-order.service.js`
  * `src/services/refund/refund.service.js`
  * `src/services/exchange/exchange-money.service.js`
  * `src/services/rental/rental-money.service.js`
  * `src/services/subscription/subscription.service.js`
  * `src/services/user-wallet/user-wallet.service.js`
  * `src/services/wallet/wallet.service.js`
  * `src/utils/idempotency-command.util.js`
  * `src/models/payment-attempt.model.js`
  * `src/models/checkout.model.js`
  * `src/models/inventory-reservation.model.js`
  * `src/models/accounting-transaction.model.js`
  * `src/models/accounting-entry.model.js`
  * `src/models/accounting-account.model.js`
  * `src/models/order-case.model.js`
  * `src/models/refund.model.js`
  * `src/models/shipment.model.js`
  * `src/models/job-lease.model.js`
  * `src/models/rental-slot.model.js`
  * `src/models/idempotency-command.model.js`
  * `scripts/migrate-marketplace-v1.js`
  * `.github/workflows/marketplace-quality-gate.yml`
  * `tests/integration/marketplace-v1.test.js`
  * `tests/integration/exchange.test.js`
  * `tests/integration/rental.test.js`
  * `Note/upgrade/MARKETPLACE_V1_RUNBOOK.md`
  * `Note/upgrade/phase-reports/*`

## 2. Kiểm tra đã chạy

* `npm run lint`: PASS — chạy cuối ngày 2026-07-15, exit code 0, không có error/warning.
* `npm run typecheck`: NOT RUN — `package.json` không có script `typecheck`; dự án backend hiện là JavaScript.
* `npm run test`: PASS — chạy thật ngày 2026-07-15, exit code 0; gồm unit và toàn bộ integration serial.
* `npm run build`: NOT RUN — `package.json` không có script `build`; backend chạy trực tiếp bằng Node.js.

Kiểm tra bổ sung:

* `npm run test:unit`: PASS — 7/7 suite, 66/66 test.
* `npm run test:integration`: PASS — toàn bộ 14 file integration chạy serial, exit code 0.
* `npm run migrate:marketplace-v1 -- --dry-run`: PASS — chạy trên DB `anhdecor`, không apply và đã tắt auto-index trong dry-run.
* Migration `--apply`: NOT RUN — chưa có xác nhận backup/restore và còn 4 record cần đối soát thủ công.
* PayOS/VNPay sandbox E2E bằng merchant credential thật: NOT RUN — workspace không có credential/merchant environment dùng cho nghiệm thu bên ngoài.

Kết quả concurrency/security quan trọng:

* Hai buyer tranh SKU cuối: PASS, đúng một checkout thành công, không oversell.
* Hai request checkout cùng `Idempotency-Key`: PASS, chỉ một checkout/reservation.
* Hai request wallet payment đồng thời: PASS, chỉ trừ ví và post ledger một lần.
* PayOS return giả và webhook sai signature: PASS, không tạo paid.
* VNPay Return read-only, IPN signed replay: PASS, chỉ một capture và hai accounting entry.
* Exchange escrow/dispute/refund: PASS, 5/5 integration test.
* Rental slot/payment/deposit/late fee/claim: PASS, 8/8 integration test.
* Upload giả MIME: PASS, bị từ chối.
* Admin list PII/bank masking và authorization scope: PASS.

Feature flag production hiện tại:

* `COMMERCE_ENABLED=false`
* `PAYOS_PAYMENTS_ENABLED=false`
* `VNPAY_PAYMENTS_ENABLED=false`
* `WALLET_PAYMENTS_ENABLED=false`
* `WITHDRAWALS_ENABLED=false`
* `EXCHANGE_ENABLED=false`
* `RENTAL_ENABLED=false`
* `SUBSCRIPTION_PAYMENT_ENABLED=false`
* `ROOM_VISUALIZER_ENABLED=false`
* `REQUIRE_MONGO_TRANSACTIONS=true`

Migration dry-run và reconciliation:

* Product cần migrate: 62.
* Order cần migrate: 14.
* Legacy payment cần migrate: 2.
* Subscription record cần migrate: 11.
* Visualizer record cần gán quota: 6.
* Opening/pending account cần tạo: 7.
* Record cần manual reconciliation: 4.
* Test reconciliation trên transaction mới: `matched`, ledger drift 0, payment chain issue 0.
* Reconciliation production sau migration: NOT RUN vì migration chưa apply.

## 3. Lỗi và vấn đề còn lại

* Lỗi hiện tại: Không có lỗi code/test đang mở; lint, unit, integration và `npm test` cuối đều PASS.
* Phần chưa hoàn thành: Production cutover chưa thực hiện; chưa apply migration, chưa chạy sandbox merchant thật và chưa bật feature flag production.
* Rủi ro hoặc lưu ý:
  * Không được chạy `--apply` trước khi backup, thử restore và xử lý/phê duyệt 4 record manual reconciliation.
  * Không bật payment/refund/withdrawal trước khi hoàn tất PayOS/VNPay sandbox E2E với credential thật.
  * Nhánh legacy chỉ dành cho record lịch sử không có checkout; money record mới ở `/api/v1` đi qua engine chung.
  * Một lần full integration trước đó FAIL do unique sparse index nhận `topup: null`; lỗi đã được sửa bằng partial index theo ObjectId, migration có bước dọn index cũ, và hai lần quality gate đầy đủ sau đó đều PASS.

## 4. Trạng thái cuối

* Task: COMPLETED
* Sẵn sàng sang phase tiếp theo: YES
* Lý do: Toàn bộ implementation trong kế hoạch đã được đưa về API `/api/v1` và qua quality gate cuối. Có thể bắt đầu phase FE/API integration; riêng production enablement vẫn phải qua backup, manual reconciliation, sandbox E2E và rollout checklist nêu trên.

## 5. Nghiệm thu bổ sung ngày 2026-07-15

* Đã bổ sung idempotency cho resolution/refund và test concurrent partial refund/withdrawal completion.
* Đã bổ sung multipart upload ảnh bằng chứng cho order case với kiểm tra nội dung ảnh và cleanup khi transaction thất bại.
* Hậu kiểm `marketplace-v1` và `commerce-refund-withdrawal`: PASS — 2 suite, 11 test.
* Báo cáo chi tiết: `Note/upgrade/phase-reports/phase-9-final-acceptance.md`.
