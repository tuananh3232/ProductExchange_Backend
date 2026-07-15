# Phase 2 — SKU và inventory reservation

Trạng thái implementation: COMPLETED.

- Product hỗ trợ variant/SKU, `stockOnHand`, `reservedStock`, price và attributes; product cũ được migration thành default SKU.
- `InventoryReservation` có active/consumed/released/expired và expiry job bằng Mongo lease.
- Reserve dùng conditional atomic update; consume/release idempotent trong transaction.
- Checkout không đổi toàn bộ product sang pending; shop bị suspend hoặc product không khả dụng không thể reserve.
- Concurrency test nhiều buyer tranh SKU cuối: đúng một checkout thành công, không oversell, tồn kho không âm.
