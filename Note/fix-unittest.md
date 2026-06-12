Bạn là Senior Backend Engineer.

Tôi đang làm trong project Node.js Express MongoDB dùng Jest + Supertest.

Branch làm việc:

`test/clean-test-suite-only`

Mục tiêu tổng thể:
Clean lại toàn bộ test suite theo hướng:

* Không còn hai hệ test chồng lên nhau.
* Legacy test được archive rõ ràng.
* Active Jest chỉ chạy test trong `tests/integration` và `tests/unit`.
* Không import hoặc execute legacy test.
* Không phụ thuộc assertion cũ đã lệch behavior.
* Helper test rõ ràng, không che lỗi thật.
* Test DB có guard an toàn.
* Coverage có chế độ chạy serial.
* Sau đó thay placeholder bằng test thật từng file.
* Cuối cùng full test pass và tạo PR vào `dev`.

Phạm vi branch này:

* Chỉ làm test, test infra, script test, tài liệu test.
* Không sửa business logic nếu không bắt buộc.
* Không thêm API mới.
* Không sửa cart/order/payment/shop business flow.
* Không xử lý report BE/FE improvement trong branch này.
* Không sửa các file `src` nếu không có lý do rất rõ ràng.

Các thư mục/file chính:

* `jest.config.js`
* `package.json`
* `scripts/test/`
* `tests/setup/`
* `tests/integration/`
* `tests/unit/`
* `tests/_legacy/`
* `tests/_legacy/TEST_CLEANUP_REPORT.md`
* `Note/unit-test/` hoặc `Note/test-prompts/`

==================================================
PHẦN 1 — KIỂM TRA BRANCH VÀ PHẠM VI
===================================

1. Kiểm tra trạng thái Git:

Chạy:

`git status --short`

Nếu có file ngoài phạm vi test/docs như:

* `src/controllers/...`
* `src/services/...`
* `src/routes/...`
* `src/models/...`
* `src/validations/...`

thì không tự ý sửa tiếp. Báo cáo lại để tôi quyết định.

2. Kiểm tra diff so với dev:

Chạy:

`git diff --name-status origin/dev..HEAD`

Branch này chỉ nên chứa:

* `jest.config.js`
* `package.json`
* `scripts/test/...`
* `tests/...`
* `Note/unit-test/...` hoặc `Note/test-prompts/...`

Không nên chứa thay đổi business trong `src`.

==================================================
PHẦN 2 — DỌN CẤU TRÚC TEST
==========================

Hiện trạng mong muốn:

* Jest chỉ scan:

  * `tests/integration/**/*.test.js`
  * `tests/unit/**/*.test.js`
* Active suite gồm 7 file:

  * `tests/integration/auth-rbac.test.js`
  * `tests/integration/admin-stats.test.js`
  * `tests/integration/product-shop.test.js`
  * `tests/integration/cart-order-payment.test.js`
  * `tests/integration/wallet.test.js`
  * `tests/integration/notification-chat.test.js`
  * `tests/unit/shop.service.unit.test.js`

Nhiệm vụ:

1. Kiểm tra root `tests/`.

Nếu còn file `.test.js` nằm trực tiếp trong root `tests/`, ví dụ:

* `tests/auth.test.js`
* `tests/product.test.js`
* `tests/wallet.test.js`
* `tests/shop.test.js`
* `tests/shop.service.unit.test.js`
* file `.test.js` cũ khác

thì không xóa ngay. Hãy move vào:

`tests/_legacy/`

Sau khi dọn:

* Root `tests/` không còn file `.test.js` trực tiếp.
* Active tests chỉ nằm trong `tests/integration/` và `tests/unit/`.
* Legacy tests chỉ nằm trong `tests/_legacy/`.

2. Không xóa `tests/_legacy`.

Lý do:

* Legacy dùng để audit.
* Có thể đối chiếu khi viết lại test thật.
* Chỉ xóa legacy sau khi test mới ổn, PR merge vào `dev`, và team xác nhận không cần nữa.

3. Kiểm tra active tests không import legacy.

Mở 7 file active:

* `tests/integration/auth-rbac.test.js`
* `tests/integration/admin-stats.test.js`
* `tests/integration/product-shop.test.js`
* `tests/integration/cart-order-payment.test.js`
* `tests/integration/wallet.test.js`
* `tests/integration/notification-chat.test.js`
* `tests/unit/shop.service.unit.test.js`

Đảm bảo không có dòng import từ:

* `tests/_legacy`
* `../_legacy`
* `../../_legacy`

Nếu có thì xóa import đó.

4. Nếu file active đang rỗng hoàn toàn, chỉ thêm placeholder tối thiểu:

```js
describe('test suite placeholder', () => {
  it('should load test suite', () => {
    expect(true).toBe(true)
  })
})
```

Không viết test thật ở bước này.

==================================================
PHẦN 3 — DỌN FILE TẠM/RESULT KHÔNG CẦN THIẾT
============================================

Kiểm tra và xóa nếu còn các file tạm ở root project:

* `auth-result.json`
* `product-result.json`
* `product-refactor-result.json`
* `tests-result.json`

Nếu các file này đã ở trạng thái deleted trong Git thì giữ trạng thái deleted.

Không xóa file khác nếu không chắc chắn.

==================================================
PHẦN 4 — CẬP NHẬT TEST CLEANUP REPORT
=====================================

Cập nhật file:

`tests/_legacy/TEST_CLEANUP_REPORT.md`

Report cần ghi rõ:

1. Legacy tests đã được archive trong:

   * `tests/_legacy/`

2. Active Jest chỉ scan:

   * `tests/integration/**/*.test.js`
   * `tests/unit/**/*.test.js`

3. Root `tests/` không còn file `.test.js` trực tiếp.

4. Legacy chỉ để audit/tham khảo, không execute.

5. Liệt kê 7 active test files hiện tại:

   * `tests/integration/auth-rbac.test.js`
   * `tests/integration/admin-stats.test.js`
   * `tests/integration/product-shop.test.js`
   * `tests/integration/cart-order-payment.test.js`
   * `tests/integration/wallet.test.js`
   * `tests/integration/notification-chat.test.js`
   * `tests/unit/shop.service.unit.test.js`

6. Liệt kê file nào đã move thêm vào `_legacy` nếu có.

7. Liệt kê file result/log tạm đã xóa nếu có.

8. Ghi rõ tình trạng hiện tại:

   * Nếu active tests còn placeholder, ghi rõ còn placeholder.
   * Bước tiếp theo là thay placeholder bằng test thật từng file.

==================================================
PHẦN 5 — TỐI ƯU HELPER AUTH
===========================

Mở file:

`tests/setup/auth.js`

Kiểm tra các helper như:

* `createAndLogin`
* `loginAsAdmin`
* `loginAsMember`
* `createUserWithToken`
* các helper tạo token khác

Yêu cầu:

1. `createAndLogin` phải fail-fast:

   * Nếu register fail thì throw error hoặc expect fail rõ ràng.
   * Nếu login fail thì throw error.
   * Nếu response không có access token thì throw error.
   * Không được tự tạo JWT fallback trong `createAndLogin`.

2. Nếu cần bypass login cho test không kiểm tra login flow, tạo hàm riêng:

   * `createUserWithToken`
   * hoặc `createAuthTokenForUser`

3. Hàm bypass token phải có comment rõ:

   * Chỉ dùng khi test không cần kiểm tra login thật.
   * Không dùng cho test auth/login.

4. Không để helper login che lỗi thật của auth flow.

5. Không sửa business logic trong `src` để test pass.

==================================================
PHẦN 6 — TEST DB SETUP VÀ GUARD
===============================

Mở các file setup test trong:

`tests/setup/`

Yêu cầu:

1. Test DB phải có guard an toàn:

   * Không được chạy trên DB không kết thúc bằng `_test`.
   * Nếu DB name là `productexchange`, `prod`, `production`, hoặc không xác định thì phải throw error.

2. Test nên ưu tiên dùng:

   * `MONGODB_URI_TEST`
   * `TEST_DB_NAME`

3. Nếu hiện tại vẫn phụ thuộc MongoDB Atlas/cloud:

   * Không bắt buộc đổi sang mongodb-memory-server ở bước này.
   * Chỉ ghi TODO trong report/README rằng nên chuyển sang local MongoDB, Docker MongoDB hoặc mongodb-memory-server để tránh timeout/flaky.

4. Không để test tự động xóa DB thật.

==================================================
PHẦN 7 — TỐI ƯU COVERAGE SCRIPT
===============================

Mở:

`package.json`

Nếu `test:coverage` đang chạy parallel, giữ nguyên nếu team đang dùng.

Thêm script mới:

```json
"test:coverage:serial": "node --experimental-vm-modules node_modules/jest/bin/jest.js --coverage --runInBand"
```

Không phá script cũ.

Mục đích:

* Integration test dùng chung DB nên coverage chạy serial sẽ ổn định hơn.

==================================================
PHẦN 8 — NOTE PROMPT FOLDER
===========================

Nếu có thư mục:

`Note/unit-test/`

thì kiểm tra README.

Vì phần lớn prompt là integration test, tên `unit-test` có thể gây hiểu nhầm.

Có 2 lựa chọn:

Lựa chọn A — Giữ nguyên:

* Cập nhật README ghi rõ:

  * Folder này chứa prompt cho cả integration test và unit test.
  * Không chỉ riêng unit test.

Lựa chọn B — Rename nếu an toàn:

* Rename `Note/unit-test/` thành:

  * `Note/test-prompts/`

Chỉ rename nếu không gây rối Git và không ảnh hưởng file khác.

Không bắt buộc rename.

==================================================
PHẦN 9 — CHẠY KIỂM TRA SAU KHI DỌN INFRA
========================================

Chạy:

`npm test -- --listTests`

`npm test -- --runInBand`

`npm run test:coverage:serial`

`git diff --name-status`

`git diff --check`

Kết quả mong muốn:

* Jest chỉ nhận 7 active files.
* Test pass.
* Coverage serial chạy được.
* Không còn `tests/*.test.js` cũ ở root.
* Không có active test import `_legacy`.
* Không sửa business logic trong `src`.
* `git diff --check` pass.

Nếu coverage fail do DB/env thiếu, báo rõ lý do. Không tự ý sửa business logic.

==================================================
PHẦN 10 — COMMIT CHECKPOINT INFRA
=================================

Sau khi phần infra pass, báo cáo để tôi commit.

Commit message đề xuất:

`test: tidy test structure and helpers`

Các file được phép commit:

* `tests/...`
* `package.json`
* `jest.config.js`
* `scripts/test/...`
* `Note/unit-test/...` hoặc `Note/test-prompts/...`

Không commit file `src/...` nếu có thay đổi ngoài phạm vi.

==================================================
PHẦN 11 — VIẾT TEST THẬT TỪNG FILE
==================================

Sau khi test infra sạch, bắt đầu thay placeholder bằng test thật.

Quy tắc:

* Mỗi lần chỉ làm 1 file.
* Không sửa file test khác.
* Không import `_legacy`.
* Không assert theo dữ liệu legacy.
* Dùng helper trong `tests/setup`.
* Nếu helper thiếu, chỉ bổ sung tối thiểu.
* Chạy test riêng file đó.
* Chạy full test.
* Commit riêng từng file.

Thứ tự làm:

1. `tests/integration/auth-rbac.test.js`
2. `tests/integration/admin-stats.test.js`
3. `tests/integration/product-shop.test.js`
4. `tests/integration/cart-order-payment.test.js`
5. `tests/integration/wallet.test.js`
6. `tests/integration/notification-chat.test.js`
7. `tests/unit/shop.service.unit.test.js`

---

## FILE 1 — auth-rbac.test.js

Chỉ sửa:

`tests/integration/auth-rbac.test.js`

Có thể sửa tối thiểu trong `tests/setup` nếu helper thiếu.

Test cần bao phủ:

* Register member thành công.
* Login user chưa verify bị chặn nếu hệ thống hiện tại yêu cầu verify.
* Login user đã verified thành công và trả access token.
* Không token gọi protected API nhận 401.
* Member gọi API admin nhận 403.
* Admin gọi API admin thành công.
* Email test phải unique.
* Không để rate limit làm test fail 429 trong `NODE_ENV=test`.

Chạy:

`npm test -- tests/integration/auth-rbac.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add auth rbac integration tests`

---

## FILE 2 — admin-stats.test.js

Chỉ sửa:

`tests/integration/admin-stats.test.js`

Test cần bao phủ:

* Không token gọi API admin nhận 401.
* Member gọi API admin nhận 403.
* Admin gọi được API danh sách user hoặc API admin chính đang có.
* Admin xem danh sách product/shop/category nếu endpoint hiện có.
* Admin xem stats nếu endpoint hiện có.
* Không assert cứng dữ liệu từ DB chính.
* Nếu stats cần dữ liệu, tự tạo fixture tối thiểu.

Chạy:

`npm test -- tests/integration/admin-stats.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add admin stats integration tests`

---

## FILE 3 — product-shop.test.js

Chỉ sửa:

`tests/integration/product-shop.test.js`

Test cần bao phủ:

* Shop owner tạo shop thành công.
* Shop submit review nếu flow hiện có.
* Admin approve shop nếu endpoint hiện có.
* Shop owner tạo product thuộc shop.
* Seller tạo product cá nhân nếu role seller được phép.
* Member không được tạo product.
* Public list product chỉ thấy product active/available theo behavior hiện tại.
* Seller/shop owner không quản lý product không thuộc quyền mình.

Chạy:

`npm test -- tests/integration/product-shop.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add product shop integration tests`

---

## FILE 4 — cart-order-payment.test.js

Chỉ sửa:

`tests/integration/cart-order-payment.test.js`

Test cần bao phủ:

* Member add product vào cart.
* Update quantity cart item.
* Remove cart item.
* Tạo order từ cart nếu endpoint hiện có.
* Buyer cancel order restore product nếu behavior hiện tại có.
* Payment cancel/fail restore product pending nếu flow hiện có.
* Không gọi VNPay/PayOS thật.
* Mock payment provider nếu cần.
* Không phụ thuộc order/payment legacy.

Chạy:

`npm test -- tests/integration/cart-order-payment.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add cart order payment integration tests`

---

## FILE 5 — wallet.test.js

Chỉ sửa:

`tests/integration/wallet.test.js`

Test cần bao phủ:

* User/member xem wallet của mình nếu endpoint hiện có.
* Shop owner xem shop wallet nếu endpoint hiện có.
* Tạo topup/withdraw request theo behavior hiện tại.
* Admin approve/reject withdrawal nếu endpoint hiện có.
* Không gọi payment provider thật.
* Mock payment provider nếu cần.
* Không assert balance cứng từ DB chính.
* Tự tạo user/shop/wallet fixture cần thiết.

Chạy:

`npm test -- tests/integration/wallet.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add wallet integration tests`

---

## FILE 6 — notification-chat.test.js

Chỉ sửa:

`tests/integration/notification-chat.test.js`

Test cần bao phủ:

* User xem danh sách notification của mình.
* User xem unread count.
* Mark one notification as read.
* Mark all as read nếu endpoint hiện có.
* Delete notification nếu endpoint hiện có.
* Tạo conversation direct/shop nếu endpoint hiện có.
* Gửi message text.
* User không thuộc conversation không được đọc message.
* Không test socket realtime phức tạp ở giai đoạn đầu, trừ khi helper đã có sẵn.

Chạy:

`npm test -- tests/integration/notification-chat.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add notification chat integration tests`

---

## FILE 7 — shop.service.unit.test.js

Chỉ sửa:

`tests/unit/shop.service.unit.test.js`

Test cần bao phủ:

* Unit test service shop.
* Không gọi MongoDB thật nếu có thể mock.
* Mock repository/model/mail util nếu service đang phụ thuộc.
* Test create shop draft.
* Test submit shop for review.
* Test approve/reject shop nếu service có.
* Test invite staff bằng email nếu service có.
* Test transfer owner nếu service có.
* Không sửa business logic để test pass.
* Nếu service hiện tại khó unit test, ghi rõ phần nào nên để integration test thay vì ép mock quá mức.

Chạy:

`npm test -- tests/unit/shop.service.unit.test.js --runInBand`

`npm test -- --runInBand`

Nếu pass, commit:

`test: add shop service unit tests`

==================================================
PHẦN 12 — KIỂM TRA CUỐI SAU KHI VIẾT TEST THẬT
==============================================

Sau khi 7 file active đã có test thật, chạy:

`npm test -- --listTests`

`npm test -- --runInBand`

`npm run test:coverage:serial`

`git diff --check`

`git status`

`git diff --name-status origin/dev..HEAD`

Kết quả mong muốn:

* Jest chỉ nhận 7 active files.
* Không còn placeholder vô nghĩa.
* Không active test nào import `_legacy`.
* Full test pass.
* Coverage serial pass.
* Không lỗi whitespace.
* Branch không dính business code trong `src`.
* `git status` sạch sau khi commit.

==================================================
PHẦN 13 — CẬP NHẬT FINAL TEST CLEANUP REPORT
============================================

Cập nhật:

`tests/_legacy/TEST_CLEANUP_REPORT.md`

Thêm mục final:

## Final Status

Nội dung:

* Legacy tests archived in `tests/_legacy`.
* Active tests no longer import or execute legacy tests.
* Jest only scans:

  * `tests/integration/**/*.test.js`
  * `tests/unit/**/*.test.js`
* Root `tests/` has no direct `.test.js` files.
* Active test files:

  * `auth-rbac.test.js`
  * `admin-stats.test.js`
  * `product-shop.test.js`
  * `cart-order-payment.test.js`
  * `wallet.test.js`
  * `notification-chat.test.js`
  * `shop.service.unit.test.js`
* Total active test count.
* Final command results:

  * `npm test -- --listTests`
  * `npm test -- --runInBand`
  * `npm run test:coverage:serial`
* Remaining note:

  * `tests/_legacy` is kept for audit and may be removed in a separate PR after team approval.

Commit message:

`docs: update final test cleanup report`

==================================================
PHẦN 14 — PR VÀ DONE
====================

Chuẩn bị PR:

Base branch:

`dev`

Compare branch:

`test/clean-test-suite-only`

PR title:

`test: clean and rebuild active test suite`

PR description:

## Summary

* Archived legacy tests into `tests/_legacy`.
* Active Jest now scans only `tests/integration` and `tests/unit`.
* Removed temporary result/log files.
* Tidied root `tests/` so legacy files are not mixed with active tests.
* Added/updated shared test setup helpers.
* Added safe test DB guard.
* Added serial coverage script.
* Rebuilt active integration/unit tests by module.
* Updated final test cleanup report.

## Test

* `npm test -- --listTests`
* `npm test -- --runInBand`
* `npm run test:coverage:serial`
* `git diff --check`

## Notes

* `tests/_legacy` is intentionally kept for audit.
* Legacy tests are not imported or executed.
* Removing `tests/_legacy` should be done later in a separate PR after team approval.

==================================================
DEFINITION OF DONE
==================

Chỉ coi là DONE khi đạt đủ:

* Branch `test/clean-test-suite-only` đã push lên GitHub.
* Branch không dính thay đổi business trong `src`.
* Không còn `tests/*.test.js` cũ ở root.
* Legacy tests nằm trong `tests/_legacy`.
* Active Jest chỉ nhận 7 file active.
* Không active test nào import `_legacy`.
* File result/log tạm đã xóa nếu không cần.
* Auth helper fail-fast, không fallback token trong login helper.
* Có `test:coverage:serial`.
* 7 active test files đã có test thật.
* `npm test -- --runInBand` pass.
* `npm run test:coverage:serial` pass hoặc có lý do môi trường rõ ràng nếu không thể chạy.
* `TEST_CLEANUP_REPORT.md` cập nhật final.
* PR vào `dev` đã tạo.
* PR merge xong.
* Local `dev` đã pull code mới.

Lưu ý cuối cùng:
Không làm report BE/FE improvement hoặc API cart/options/checkout trong branch test này. Những việc đó tạo branch riêng sau.
    