Bạn là Senior Backend Engineer.

Nhiệm vụ lần này KHÔNG viết test trực tiếp. Chỉ tạo tài liệu prompt dạng Markdown trong thư mục:

`Note/unit-test/`

Mục tiêu:
Tạo prompt riêng cho từng file test active để sau này dùng từng prompt viết test thật, làm từng file một, tránh AI code lại toàn bộ test suite.

Yêu cầu chung:

1. Không sửa business logic trong `src`.
2. Không sửa trực tiếp test ở bước này.
3. Chỉ tạo/cập nhật các file `.md` trong `Note/unit-test/`.
4. Mỗi file `.md` là một prompt độc lập, dùng được để yêu cầu AI viết test thật cho đúng một file test.
5. Mỗi prompt phải nhấn mạnh:

   * Không import lại `tests/_legacy`.
   * Không sửa file test khác.
   * Không phụ thuộc dữ liệu legacy.
   * Dùng helper sẵn có trong `tests/setup`.
   * Nếu helper thiếu thì chỉ bổ sung tối thiểu trong `tests/setup`.
   * Sau khi sửa phải chạy test riêng file đó và chạy full test.
6. Tạo các file sau:

`Note/unit-test/01-auth-rbac-test.md`
Prompt cho file:
`tests/integration/auth-rbac.test.js`

Nội dung cần yêu cầu test:

* Register member thành công.
* Login user chưa verify bị chặn nếu hệ thống hiện tại yêu cầu verify.
* Login user đã verified thành công và trả access token.
* Không token gọi protected API nhận 401.
* Member gọi API admin nhận 403.
* Admin gọi API admin thành công.
* Email test phải unique.
* Không để rate limit làm test fail 429 trong `NODE_ENV=test`.

`Note/unit-test/02-admin-stats-test.md`
Prompt cho file:
`tests/integration/admin-stats.test.js`

Nội dung cần yêu cầu test:

* Admin gọi được API danh sách user hoặc API admin chính đang có.
* Không token gọi API admin nhận 401.
* Member gọi API admin nhận 403.
* Admin xem danh sách product/shop/category nếu endpoint hiện có.
* Admin xem stats nếu endpoint hiện có.
* Không assert cứng dữ liệu từ DB chính.
* Nếu endpoint stats cần dữ liệu, tự tạo fixture tối thiểu.

`Note/unit-test/03-product-shop-test.md`
Prompt cho file:
`tests/integration/product-shop.test.js`

Nội dung cần yêu cầu test:

* Shop owner tạo shop thành công.
* Shop submit review nếu flow hiện có.
* Admin approve shop nếu endpoint hiện có.
* Shop owner tạo product thuộc shop.
* Seller tạo product cá nhân nếu role seller được phép.
* Member không được tạo product.
* Public list product chỉ thấy product active/available theo behavior hiện tại.
* Seller/shop owner không quản lý product không thuộc quyền mình.

`Note/unit-test/04-cart-order-payment-test.md`
Prompt cho file:
`tests/integration/cart-order-payment.test.js`

Nội dung cần yêu cầu test:

* Member add product vào cart.
* Update quantity cart item.
* Remove cart item.
* Tạo order từ cart nếu endpoint hiện có.
* Buyer cancel order restore product nếu behavior hiện tại có.
* Payment cancel/fail restore product pending nếu flow hiện có.
* Không gọi VNPay/PayOS thật; mock nếu cần.
* Không phụ thuộc order/payment legacy.

`Note/unit-test/05-wallet-test.md`
Prompt cho file:
`tests/integration/wallet.test.js`

Nội dung cần yêu cầu test:

* User/member xem wallet của mình nếu endpoint hiện có.
* Shop owner xem shop wallet nếu endpoint hiện có.
* Tạo topup/withdraw request theo behavior hiện tại.
* Admin approve/reject withdrawal nếu endpoint hiện có.
* Không gọi payment provider thật; mock nếu cần.
* Không assert balance cứng từ DB chính.
* Tự tạo user/shop/wallet fixture cần thiết.

`Note/unit-test/06-notification-chat-test.md`
Prompt cho file:
`tests/integration/notification-chat.test.js`

Nội dung cần yêu cầu test:

* User xem danh sách notification của mình.
* User xem unread count.
* Mark one notification as read.
* Mark all as read nếu endpoint hiện có.
* Delete notification nếu endpoint hiện có.
* Tạo conversation direct/shop nếu endpoint hiện có.
* Gửi message text.
* User không thuộc conversation không được đọc message.
* Không test socket realtime phức tạp ở giai đoạn đầu, trừ khi helper đã có sẵn.

`Note/unit-test/07-shop-service-unit-test.md`
Prompt cho file:
`tests/unit/shop.service.unit.test.js`

Nội dung cần yêu cầu test:

* Unit test service shop, không gọi MongoDB thật nếu có thể mock.
* Mock repository/model/mail util nếu service đang phụ thuộc.
* Test create shop draft.
* Test submit shop for review.
* Test approve/reject shop nếu service có.
* Test invite staff bằng email nếu service có.
* Test transfer owner nếu service có.
* Không sửa business logic để test pass.
* Nếu service hiện tại khó unit test, ghi rõ phần nào cần integration test thay vì ép mock quá mức.

Tạo thêm:

`Note/unit-test/README.md`

README cần có:

* Mục tiêu thư mục này.
* Thứ tự dùng prompt.
* Quy tắc mỗi lần chỉ dùng một prompt.
* Sau mỗi file test pass thì commit riêng.
* Lệnh kiểm tra:

  * `npm test -- --listTests`
  * `npm test -- tests/integration/<file>.test.js --runInBand`
  * `npm test -- --runInBand`
  * `npm run test:coverage`

Không tạo test thật ở bước này.
Chỉ tạo/cập nhật các file `.md` trong `Note/unit-test/`.
