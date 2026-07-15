# Phase 7 — Exchange, rental, subscription và visualizer

Trạng thái implementation: COMPLETED.

- Exchange dùng double-entry engine chung: tiền bù vào exchange escrow, chỉ release khi hai bên nhận hàng; dispute giữ escrow; admin refund idempotent.
- Rental dùng unique daily slot trong transaction, chống booking trùng; rent/deposit/additional charge/late fee/claim/refund/settlement dùng rental escrow và ledger chung.
- Subscription wallet chạy state, wallet, ledger và VIP activation trong một transaction; PayOS activation chỉ sau webhook verified, replay idempotent.
- Room visualizer dùng atomic quota slot, upload security và feature flag.
- Scheduler maintenance dùng Mongo job lease, retry/dead state, không còn phụ thuộc setInterval riêng cho rental.
- Integration: exchange 5/5, rental 8/8; subscription unit 11/11; concurrency booking và payment đều PASS.

Rollout gate: các module vẫn mặc định tắt ở production và chỉ bật từng flag sau smoke test tại môi trường đích.
