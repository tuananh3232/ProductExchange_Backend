# Phase 4 — Double-entry ledger, escrow và wallet

Trạng thái implementation: COMPLETED.

- Accounting engine bắt buộc tổng debit bằng tổng credit trước commit; command key unique chống double-posting.
- Có provider clearing, user wallet liability, order/exchange/rental escrow, shop/seller available, platform revenue, refund payable và withdrawal pending.
- Payment capture, fee snapshot, settlement, refund, top-up, exchange, rental và withdrawal đều ghi state + wallet + ledger trong Mongo transaction.
- Wallet payment concurrent cùng idempotency key chỉ trừ một lần; fee snapshot không thay đổi theo policy tương lai.
- Reconciliation test cho payment chain trả `matched`, ledger drift bằng 0. Dữ liệu thật trước migration có 4 record phải đưa vào manual reconciliation, không tự replay.
