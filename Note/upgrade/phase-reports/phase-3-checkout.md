# Phase 3 — Checkout, order group và snapshot

Trạng thái implementation: COMPLETED.

- `POST /api/v1/checkouts` tạo checkout nhiều merchant, một order cho mỗi shop/seller, `items[]` snapshot, shipping snapshot và amount breakdown.
- Reserve toàn bộ item, tạo checkout/orders và cập nhật cart trong cùng Mongo transaction; lỗi giữa chừng rollback toàn bộ.
- Idempotency command có lease bền vững, chống hai request đồng thời cùng key trên nhiều instance.
- Adapter `/api/v1/orders` tạo checkout một item; cart checkout và endpoint payment cũ chuyển commerce record sang engine chung.
- Concurrent retry cùng key trả một checkout; multi-shop, rollback và cart compatibility đã qua integration test.
