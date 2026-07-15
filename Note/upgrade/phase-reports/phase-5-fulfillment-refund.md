# Phase 5 — Fulfillment, return, refund và dispute

Trạng thái implementation: COMPLETED.

- Order commerce state machine, shipment/tracking/proof/history, buyer confirm-received và auto-complete bằng Mongo job lease đã được triển khai trên `/api/v1`.
- Seller không có đường tự chuyển thẳng completed; settlement chỉ release sau buyer confirm hoặc hết dispute window.
- `OrderCase` giữ return/dispute/evidence/admin resolution; case mở sẽ giữ escrow.
- Refund giới hạn theo captured amount trừ các refund thành công trước đó, idempotent; wallet tự động, VNPay provider workflow, PayOS manual evidence.
- Cancel/refund/settlement đều dùng conditional transition, audit log và transaction.

Rollout gate: provider refund sandbox thật cần credential VNPay/PayOS của môi trường triển khai.
