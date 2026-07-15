# Phase 9 — Nghiệm thu cuối marketplace `/api/v1`

## Phạm vi hoàn thiện

* Sửa giới hạn hoàn tiền: tổng tiền đã giữ chỗ gồm cả refund `requested`, ngăn nhiều yêu cầu chưa xử lý vượt captured amount.
* Resolution order case idempotent bằng unique `resolutionIdempotencyKey`.
* Wallet refund, PayOS manual refund và withdrawal completion replay/concurrent chỉ ghi wallet/ledger một lần.
* Buyer case hỗ trợ tối đa 6 ảnh bằng chứng qua multipart; dùng chung middleware kiểm tra magic content, pixel limit, re-encode và xóa metadata.
* Ảnh đã upload được dọn nếu transaction tạo case thất bại.

## Kết quả kiểm tra

* `npm run lint`: PASS.
* `npm run test:unit`: PASS — 7 suite, 66 test.
* `npm run test:integration`: PASS — full run 14 suite, thời gian 526,1 giây.
* Hậu kiểm `marketplace-v1` + `commerce-refund-withdrawal`: PASS — 2 suite, 11 test.
* Migration `node scripts/migrate-marketplace-v1.js --dry-run`: PASS, không ghi dữ liệu.
* MongoDB runtime: Atlas replica set, writable primary, transaction-capable.

## Bằng chứng concurrency/security

* SKU cuối bị tranh chấp: đúng một checkout thành công, không oversell.
* Checkout/payment cùng idempotency key: không tạo giao dịch trùng.
* Forged PayOS return và webhook sai signature: không tạo paid.
* VNPay IPN replay: đúng một capture.
* Partial refund replay/concurrent: không vượt captured amount, không credit hai lần.
* Withdrawal concurrent completion: đúng một lần hoàn tất và hai accounting entry cân bằng.
* Upload giả MIME: bị từ chối.
* Reconciliation integration: matched, ledger drift 0, payment-chain issue 0.

## Rollout

Implementation và automated acceptance: COMPLETED. Merchant sandbox thật, migration `--apply` và production rollout chưa chạy; các feature flag tiền vẫn phải giữ tắt cho đến khi backup/restore, xử lý 4 record manual reconciliation và sandbox payment hoàn tất.
