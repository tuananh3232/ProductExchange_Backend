Bạn hãy sửa lại toàn bộ hệ thống Permission/RBAC của project backend theo hướng permission matrix chi tiết, hợp lý, dễ phân quyền cho shop staff.

## 0. Nguyên tắc bắt buộc

* Được sửa code.
* Được sửa constant, middleware, validation schema, service, route, seed RBAC, test nếu cần.
* Không tạo role `manager`.
* Không tạo permission cho `auth:login`, `auth:logout`, `auth:register` vì auth là hành vi mặc định của hệ thống.
* `admin` là role full quyền toàn hệ thống.
* Không cần tạo chi tiết permission dạng `admin:user:read`, `admin:shop:approve`, `admin:product:update`, v.v.
* Với mọi middleware permission, nếu user là `admin` thì được bypass/full access.
* Không dùng permission kiểu gom chung `manage_*` trong matrix mới.
* Permission mới phải tách rõ theo hành động cụ thể như:

  * `read`
  * `create`
  * `update`
  * `delete`
  * `confirm`
  * `cancel`
  * `invite`
  * `remove`
  * `transfer`
  * `view_stats`
  * `request_withdrawal`
* Phải tách rõ:

  * User/member permission
  * Seller permission
  * Shop owner permission
  * Shop scoped permission cho staff shop
  * Admin full quyền/bypass

## 1. File cần rà soát và sửa

Hãy rà soát toàn bộ các file liên quan, tối thiểu gồm:

* `src/constants/permission.constant.js`
* `src/constants/role.constant.js`
* `src/middlewares/auth.middleware.js`
* `src/services/rbac/rbac-seed.service.js`
* Các route đang dùng `requirePermissions`, `requireRoles`, `requireShopPermission`
* Các service có check quyền shop/staff
* Các validation schema liên quan tới invite staff, update staff permission
* Các test liên quan tới RBAC, shop, staff, product, order, wallet nếu có

Nếu tên role hiện tại trong code là `staff` thì giữ tương thích với code hiện tại, nhưng trong báo cáo ghi rõ đây là staff shop. Không tự ý đổi tên role sang `staff_shop` nếu gây breaking change lớn.

## 2. Thiết kế permission mới

Sửa permission theo format:

`scope:resource:action`

Ví dụ:

* `user:order:create`
* `seller:product:update`
* `shop:product:create`
* `shop:order:update_status`
* `shop:staff:invite`

Không tạo nhóm `admin:*` vì admin full quyền.

## 3. Permission cho user/member

Tạo hoặc chuẩn hoá các permission sau:

```js
user:self:read
user:self:update

user:cart:read
user:cart:update
user:cart:clear
user:cart:checkout

user:order:create
user:order:read
user:order:cancel

notification:self:read
notification:self:update
notification:self:delete
```

Member chỉ được thao tác với dữ liệu của chính mình.

## 4. Permission cho seller cá nhân

Tạo hoặc chuẩn hoá các permission sau:

```js
seller:product:read
seller:product:create
seller:product:update
seller:product:delete
seller:product:update_status
seller:product:image_update

seller:order:read
seller:order:confirm
seller:order:cancel
seller:order:update_status

wallet:self:read
wallet:self_transaction:read
wallet:withdrawal:create
wallet:withdrawal:read
```

Seller chỉ được thao tác với tài nguyên thuộc chính seller đó.

## 5. Permission cho shop owner và shop scoped staff

Tạo hoặc chuẩn hoá các permission sau:

```js
shop:profile:read
shop:profile:update
shop:profile:submit_review

shop:stats:read

shop:owner:transfer

shop:product:read
shop:product:create
shop:product:update
shop:product:delete
shop:product:update_status
shop:product:image_update
shop:product:visual_asset_manage

shop:order:read
shop:order:confirm
shop:order:cancel
shop:order:update_status

shop:staff:read
shop:staff:invite
shop:staff:remove

shop:staff_permission:read
shop:staff_permission:update

shop:chat:read
shop:chat:send
shop:chat:mark_read

shop:wallet:read
shop:wallet_transaction:read

shop:withdrawal:create
shop:withdrawal:read
```

Quy tắc:

* `shop_owner` có toàn quyền trong shop của mình.
* `staff` / staff shop chỉ có quyền theo từng shop.
* Staff shop chỉ được nhận quyền bắt đầu bằng `shop:*`.
* Staff shop không được nhận `admin:*`.
* Staff shop không được nhận `seller:*`.
* Staff shop không được nhận `user:*` dưới dạng shop permission.
* Staff shop không nên được gán:

  * `shop:owner:transfer`
  * `shop:staff_permission:update`
  * `shop:withdrawal:create`
    trừ khi hệ thống có logic đặc biệt cho phép.

## 6. Danh sách SHOP_STAFF_PERMISSIONS riêng

Bắt buộc tạo danh sách riêng cho permission staff shop, ví dụ:

```js
SHOP_STAFF_PERMISSIONS = [
  'shop:profile:read',
  'shop:profile:update',

  'shop:stats:read',

  'shop:product:read',
  'shop:product:create',
  'shop:product:update',
  'shop:product:delete',
  'shop:product:update_status',
  'shop:product:image_update',
  'shop:product:visual_asset_manage',

  'shop:order:read',
  'shop:order:confirm',
  'shop:order:cancel',
  'shop:order:update_status',

  'shop:staff:read',
  'shop:staff:invite',
  'shop:staff:remove',
  'shop:staff_permission:read',

  'shop:chat:read',
  'shop:chat:send',
  'shop:chat:mark_read',

  'shop:wallet:read',
  'shop:wallet_transaction:read',
  'shop:withdrawal:read'
]
```

Không dùng `Object.values(PERMISSIONS)` để validate quyền staff shop nữa.

Nếu hiện tại schema invite/update staff permission đang dùng `Object.values(PERMISSIONS)`, hãy sửa lại để chỉ cho phép `SHOP_STAFF_PERMISSIONS`.

## 7. Preset quyền cho staff shop

Không tạo role mới. Chỉ tạo preset để owner dễ chọn khi phân quyền.

Tạo constant nếu phù hợp:

### Product Staff

```js
shop:product:read
shop:product:create
shop:product:update
shop:product:update_status
shop:product:image_update
```

### Order Staff

```js
shop:order:read
shop:order:confirm
shop:order:update_status
shop:chat:read
shop:chat:send
```

### Customer Support Staff

```js
shop:chat:read
shop:chat:send
shop:chat:mark_read
shop:order:read
```

### Finance Staff

```js
shop:wallet:read
shop:wallet_transaction:read
shop:withdrawal:read
```

Không gán `shop:withdrawal:create` mặc định cho finance staff.

## 8. Sửa middleware quyền

Kiểm tra và sửa các middleware/hàm:

* `requirePermissions`
* `requireRoles`
* `requireShopPermission`
* Các hàm service như `assertShopPermission` nếu có

Yêu cầu:

### 8.1. Admin bypass

Nếu user có role `admin`, cho phép qua tất cả permission check.

Áp dụng cho:

* System permission check
* Shop permission check
* Route admin
* Route shop
* Product/order/wallet nếu phù hợp

### 8.2. Shop owner bypass trong shop của mình

Nếu user là `shop_owner` của shop đang thao tác, cho phép toàn quyền trong phạm vi shop đó.

Không cần shop owner phải có từng permission trong staff permission list.

### 8.3. Staff shop check theo shop

Nếu user là staff của shop, chỉ cho phép nếu staff có permission tương ứng trong shop đó.

Không cho staff dùng quyền ở Shop A để thao tác Shop B.

### 8.4. Seller ownership

Seller chỉ được thao tác với tài nguyên thuộc chính seller.

Không cho seller sửa/xoá sản phẩm của seller khác hoặc shop khác.

## 9. Sửa RBAC seed

Sửa `rbac-seed.service.js` theo hướng:

* Không seed auth permission vào matrix.
* Admin không cần seed từng permission chi tiết nếu hệ thống admin bypass bằng role.
* Member seed các quyền user cơ bản.
* Seller seed các quyền seller + user cơ bản nếu hợp lý.
* Shop owner seed quyền shop owner hoặc xử lý bằng owner bypass.
* Staff shop không nên seed full quyền mặc định; quyền staff nên nằm trong shop membership/invitation.

Nếu DB hiện đã có các permission cũ như:

```js
admin:manage_users
admin:manage_products
admin:manage_shops
admin:manage_roles
admin:manage_permissions
admin:manage_withdrawals
shop:manage_staff
shop:manage_staff_permissions
shop:chat_manage
```

thì không xoá cứng ngay nếu có thể gây lỗi dữ liệu cũ. Hãy xử lý theo một trong hai cách an toàn:

1. Giữ lại nhưng đánh dấu deprecated trong constant/comment/report.
2. Map route sang permission mới, không dùng permission cũ nữa.
3. Nếu có seed cleanup thì làm an toàn, không phá dữ liệu production.

## 10. Sửa route permission mapping

Rà toàn bộ route và đổi sang permission mới.

Gợi ý mapping:

### User / Profile

* Xem profile chính mình → `user:self:read`
* Cập nhật profile chính mình → `user:self:update`

### Cart

* Xem cart → `user:cart:read`
* Cập nhật cart → `user:cart:update`
* Clear cart → `user:cart:clear`
* Checkout → `user:cart:checkout`

### User order

* Tạo đơn → `user:order:create`
* Xem đơn của mình → `user:order:read`
* Huỷ đơn của mình → `user:order:cancel`

### Seller product

* Xem sản phẩm seller → `seller:product:read`
* Tạo sản phẩm seller → `seller:product:create`
* Cập nhật sản phẩm seller → `seller:product:update`
* Xoá sản phẩm seller → `seller:product:delete`
* Bật/tắt sản phẩm seller → `seller:product:update_status`
* Cập nhật ảnh sản phẩm seller → `seller:product:image_update`

### Shop product

* Xem sản phẩm shop → `shop:product:read`
* Tạo sản phẩm shop → `shop:product:create`
* Cập nhật sản phẩm shop → `shop:product:update`
* Xoá sản phẩm shop → `shop:product:delete`
* Bật/tắt sản phẩm shop → `shop:product:update_status`
* Cập nhật ảnh sản phẩm shop → `shop:product:image_update`
* Visual asset → `shop:product:visual_asset_manage`

### Shop order

* Xem đơn shop → `shop:order:read`
* Xác nhận đơn shop → `shop:order:confirm`
* Huỷ đơn shop → `shop:order:cancel`
* Cập nhật trạng thái đơn shop → `shop:order:update_status`

### Shop staff

* Xem staff → `shop:staff:read`
* Mời staff → `shop:staff:invite`
* Xoá staff → `shop:staff:remove`
* Xem quyền staff → `shop:staff_permission:read`
* Sửa quyền staff → `shop:staff_permission:update`

### Chat

* Xem chat shop → `shop:chat:read`
* Gửi tin nhắn shop → `shop:chat:send`
* Đánh dấu đã đọc → `shop:chat:mark_read`

### Wallet / withdrawal

* Xem ví shop → `shop:wallet:read`
* Xem giao dịch shop → `shop:wallet_transaction:read`
* Tạo yêu cầu rút tiền shop → `shop:withdrawal:create`
* Xem yêu cầu rút tiền shop → `shop:withdrawal:read`
* Seller/user xem ví cá nhân → `wallet:self:read`
* Seller/user tạo rút tiền cá nhân → `wallet:withdrawal:create`

### Admin route

* Nếu route là admin route, chỉ cần check role `admin`.
* Không cần tạo permission `admin:*`.

## 11. Sửa validation staff permission

Tìm các schema như:

* invite staff
* update staff permissions
* transfer owner nếu có
* staff permission update

Yêu cầu:

* Không dùng `Object.values(PERMISSIONS)` cho staff permission.
* Chỉ cho phép permission nằm trong `SHOP_STAFF_PERMISSIONS`.
* Nếu request chứa permission không hợp lệ, trả lỗi rõ ràng.
* Chặn owner gán quyền ngoài scope shop.
* Chặn staff tự sửa quyền của chính mình nếu có route đó.
* Chặn staff gán quyền nhạy cảm nếu không được phép.

## 12. Backward compatibility

Vì project có thể đang có dữ liệu cũ, hãy làm an toàn:

* Không đổi tên role bừa bãi nếu có thể gây lỗi.
* Nếu role hiện tại là `staff`, giữ `staff`.
* Nếu muốn chuẩn hoá thành `staff_shop`, chỉ thêm alias nếu an toàn.
* Không xoá quyền cũ khỏi database bằng script nguy hiểm.
* Không drop collection.
* Không làm migration phá dữ liệu.
* Nếu cần migration hoặc seed reset, chỉ viết script an toàn và có guard rõ ràng.
* Ưu tiên cập nhật code để dùng permission mới trước.

## 13. Test cần cập nhật hoặc thêm

Sau khi sửa code, hãy cập nhật/thêm test nếu project có test sẵn.

Tối thiểu cần có các case:

1. Admin bypass được permission check.
2. Shop owner có toàn quyền trong shop của mình.
3. Staff shop có permission thì thao tác được.
4. Staff shop không có permission thì bị chặn.
5. Staff shop không được dùng permission của Shop A cho Shop B.
6. Staff shop không thể được gán permission ngoài `SHOP_STAFF_PERMISSIONS`.
7. Staff shop không thể được gán `admin:*`.
8. Staff shop không thể được gán `seller:*`.
9. Seller chỉ sửa được sản phẩm của mình.
10. Member chỉ xem/sửa dữ liệu của mình.
11. Auth login/logout/register không phụ thuộc permission matrix.

Chạy các lệnh kiểm tra phù hợp với project, ví dụ:

```bash
npm test -- --runInBand
npm test -- --listTests
npm run lint
git diff --check
```

Nếu lint toàn project fail vì lỗi cũ ngoài phạm vi, hãy ghi rõ trong báo cáo lỗi nào là tồn đọng, lỗi nào liên quan tới phần vừa sửa.

## 14. Báo cáo sau khi sửa

Sau khi sửa xong, hãy tạo hoặc cập nhật một file báo cáo trong thư mục `Note/` hoặc `Note/permission/`, ví dụ:

```text
Note/permission/permission-matrix-refactor-report.md
```

Nội dung báo cáo gồm:

1. Tóm tắt mục tiêu.
2. File đã sửa.
3. Permission cũ nào đã deprecated.
4. Permission mới đã thêm.
5. Role matrix mới:

   * member
   * seller
   * shop_owner
   * staff/staff_shop
   * admin full quyền
6. Staff permission whitelist.
7. Route mapping đã cập nhật.
8. Test đã chạy.
9. Lỗi/tồn đọng nếu có.
10. Ghi chú migration/backward compatibility nếu có.

## 15. Kết quả mong muốn

Sau khi hoàn thành, hệ thống phải đạt các điểm sau:

* Admin full quyền bằng role, không cần permission chi tiết.
* Auth không nằm trong permission matrix.
* Không còn dùng `manage_*` cho matrix mới.
* Staff shop chỉ được gán quyền shop scoped hợp lệ.
* Shop owner có toàn quyền trong shop của mình.
* Seller chỉ quản lý tài nguyên seller.
* Member chỉ quản lý dữ liệu cá nhân.
* Route check permission rõ ràng theo `scope:resource:action`.
* Có test hoặc ít nhất cập nhật test cho các case quan trọng.
* Có báo cáo rõ ràng bằng tiếng Việt.
