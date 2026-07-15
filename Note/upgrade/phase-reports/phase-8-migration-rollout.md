# Phase 8 — Migration, tài liệu và rollout

Trạng thái implementation: COMPLETED. Trạng thái production cutover: NOT EXECUTED.

- Migration v1 có `--dry-run`, `--apply`, backup confirmation, checkpoint và thống kê; migrate default SKU, order snapshot, legacy PaymentAttempt, rental slot, visualizer quota, opening account, pending withdrawal account, PayOS counter và top-up index.
- Dry-run tắt auto-index để không ghi cả metadata. `--apply` bị chặn nếu thiếu `MIGRATION_BACKUP_CONFIRMED=true`.
- API công khai và compatibility adapter đều ở `/api/v1`; money record mới luôn gọi commerce engine chung.
- Đã có OpenAPI, environment guide, migration/cutover/payment/refund/incident runbook và CI quality gate.
- Dry-run ngày 2026-07-15 trên DB `anhdecor`: 62 product, 14 order, 2 payment, 11 subscription, 0 rental slot mới, 6 visualizer record, 7 account và 4 manual reconciliation.

Production cutover chưa được chạy vì chưa có xác nhận backup/restore, chưa xử lý 4 record đối soát và chưa có merchant credential để chạy sandbox E2E. Đây là rollout gate có chủ đích; không phải phần implementation còn bỏ dở.
