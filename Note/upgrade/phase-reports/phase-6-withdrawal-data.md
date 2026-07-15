# Phase 6 — Withdrawal và bảo vệ dữ liệu

Trạng thái implementation: COMPLETED.

- Seller cá nhân và shop reserve available balance cùng lúc tạo request; reject/payout chuyển bút toán giữa available, withdrawal pending và payout clearing.
- Transition dùng điều kiện trạng thái; bank reference unique; completed bắt buộc transfer evidence và maker-checker.
- List mask tài khoản ngân hàng; KYC private detail cần quyền chuyên biệt `admin:kyc_private:read`, mọi lượt xem có audit.
- Upload kiểm tra magic bytes, decode/re-encode, pixel limit và bỏ metadata; KYC rejected có retention job và xóa authenticated Cloudinary asset.
- Withdrawal concurrent không thể vượt available balance hoặc complete hai lần; security test xác nhận list không lộ PII/bank number.
