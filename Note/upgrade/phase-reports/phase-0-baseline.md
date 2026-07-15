# Phase 0 — Baseline và quality gate

Trạng thái implementation: COMPLETED.

- API công khai giữ nguyên namespace `/api/v1`; không tạo namespace `/api/v2`.
- Đã thêm feature flag fail-closed, kiểm tra cấu hình theo feature, kiểm tra MongoDB transaction, structured logging, correlation ID, readiness, JSON 404 và error middleware thống nhất.
- Production bắt buộc replica set/mongos cho money flow. Các feature nguy hiểm mặc định tắt trong `.env.example`.
- CI chạy lint, unit, integration serial trên MongoDB replica set và migration dry-run.
- Quality gate cuối: `npm run lint` PASS; `npm run test:unit` PASS 7 suite/66 test; `npm run test:integration` PASS toàn bộ 14 file test.

Lưu ý rollout: cấu hình secret/provider thật vẫn phải được cấp tại môi trường triển khai.
