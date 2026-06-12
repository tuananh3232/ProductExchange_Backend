# Checklist tổng hợp trạng thái `Note/bug`

Ngày cập nhật: 2026-06-08

Quy ước:

- [x] Đã có / đã fix xong.
- [ ] Chưa có.

Ghi chú scope đợt fix:

- [x] Đã xử lý các mục trong `Note/bug/be_improvements_report.md`.
- [x] Đã xử lý backend các mục trong `Note/bug/chat_shop.md`.
- [ ] Chưa xử lý `Note/bug/phanquyen.md`.

## 1. `be_improvements_report.md`

### Combo

- [x] `POST /combos/generate`
  - Có trong `src/routes/combo/combo.route.js`.
- [x] `GET /combos/alternatives`
  - Có trong `src/routes/combo/combo.route.js`.
- [x] `GET /combos/options`
  - Đã thêm `router.get('/options', optionsController.getComboOptions)`.
  - Data lấy từ `src/services/options/options.service.js` và combo constants.

### Cart Server-Driven

- [x] `POST /cart/add-combo`
  - Đã có từ trước, vẫn giữ backward compatible.
  - Response cart này có `items`, `totalItems`, `subtotal`.
- [x] `GET /cart`
  - Đã thêm trong `src/routes/cart/cart.route.js`.
- [x] `PATCH /cart/items/:productId`
  - Đã thêm validate ObjectId và Joi `quantity >= 1`.
- [x] `DELETE /cart/items/:productId`
  - Đã thêm xóa item theo productId.
- [x] `DELETE /cart`
  - Đã thêm clear toàn bộ cart.

### Checkout

- [x] `POST /cart/checkout`
  - Đã thêm tạo order từ cart.
  - Validate cart rỗng, product active/available, stock, self-order, listing type.
  - Xóa item đã checkout khỏi cart sau khi tạo order.
- [ ] Single payment URL cho checkout nhiều order
  - Hiện model payment đang gắn 1 payment với 1 order.
  - Nếu checkout 1 order với `PAYOS`/`VNPAY` thì có `paymentUrl`.
  - Nếu checkout nhiều order thì `paymentUrl` là `null`; cần chốt thêm checkout session/payment group nếu FE muốn thanh toán một link cho nhiều order.

### Metadata / Filter Options

- [x] `GET /products/filter-options`
  - Có trong `src/routes/product/product.route.js`.
- [x] `GET /orders/filter-options`
  - Có trong `src/routes/order/order.route.js`.
- [x] `GET /admin/users/filter-options`
  - Có trong `src/routes/admin/admin.route.js`.
  - Giữ `authenticate` và `requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS)`.
- [x] `GET /shops/filter-options`
  - Có trong `src/routes/shop/shop.route.js`.
- [x] `GET /kyc/filter-options`
  - Có route `src/routes/options/kyc.route.js`, mount tại `/kyc`.
- [x] `GET /withdrawals/filter-options`
  - Có route `src/routes/options/withdrawal.route.js`, mount tại `/withdrawals`.
- [x] `GET /payments/options`
  - Có trong `src/routes/payment/payment.route.js`.
- [ ] Label tiếng Việt cho options
  - Hiện đang dùng label tiếng Anh ASCII để tránh lỗi encoding/mojibake.
  - FE có thể dùng tạm hoặc yêu cầu đổi sang label tiếng Việt sau.

### User DTO

- [x] Chuẩn hóa `toUserResponse()`
  - Có các field: `id`, `email`, `name`, `fullName`, `avatarUrl`, `avatar`, `phone`, `address`, `roles`, `primaryRole`, `status`, `isActive`, `isVerified`, `createdAt`, `updatedAt`.
- [x] Login/register dùng DTO chung
  - Controller auth dùng `toUserResponse()`.
- [x] Refresh token trả user DTO chung
  - `src/services/auth/auth.service.js` đã trả `user` trong refresh result.
- [x] `GET /users/me` dùng DTO chung
  - `src/controllers/user/user.controller.js` dùng `toUserResponse(user)`.
- [x] Update profile trả user DTO
  - `src/controllers/user/user.controller.js` trả `data: { user: toUserResponse(user) }`.

### Product Media / Upload Contract

- [x] Image item có `isPrimary`
  - `src/models/product.model.js` thêm `images.isPrimary`.
- [x] Default primary cho ảnh đầu tiên nếu data cũ chưa có primary
  - Product repository/service normalize image đầu tiên là primary.
- [x] Add image mới tự set primary nếu product chưa có primary
  - `src/services/product/product.service.js`.
- [x] Remove image primary thì set ảnh còn lại đầu tiên làm primary
  - `src/services/product/product.service.js`.
- [x] Update product JSON images giữ contract `{ url, publicId, isPrimary }`
  - `src/validations/product/product.validation.js` và product service đã xử lý.

### Các nền tảng đã có từ trước

- [x] Notification cơ bản.
- [x] Payment callback/topup callback.
- [x] Room visualizer.
- [x] Product visual assets.

## 2. `chat_shop.md`

Trạng thái: đã fix backend theo `Note/fixBug/fix-chat-shop.md`.

- [x] Conversation loại shop có `shopId`, `customerId`
  - `Conversation` model có `type: SHOP`, `shopId`, `customerId`, `shopCustomerKey`.
- [x] Tạo conversation shop từ storefront
  - `POST /conversations/shop` nhận `shopId`.
- [x] ACL chat shop có actor shop
  - `assertConversationActorAccess()` chặn đúng theo `actingAs=USER/SHOP`.
  - Customer chỉ gửi được `USER`; owner/staff có `shop:chat_manage` mới gửi được `SHOP`.
- [x] List conversation theo `scope=main/workspace&shopId=...`
  - `GET /conversations?scope=main` trả inbox cá nhân.
  - `GET /conversations?scope=workspace&shopId=...` trả inbox shop workspace.
- [x] Send message với `actingAs: USER/SHOP`
  - Validation/controller/service đã nhận `actingAs` và `shopId`.
- [x] Message model có `senderType`, `senderShopId`, `senderUserId`
  - `src/models/message.model.js` đã thêm actor fields.
- [x] `lastMessage` lưu actor shop/user
  - `Conversation.lastMessage` đã có `senderType`, `senderUserId`, `senderShopId`, `createdAt`.
- [x] Socket event trả actor shop/user
  - `send_message` đi qua service chung.
  - `typing_start/typing_stop` emit thêm `actingAs` và `shopId`.
- [x] Chặn reply sai shop khi `actingAs=SHOP`
  - Service kiểm tra `shopId` phải khớp conversation và user phải có quyền chat shop đó.
- [x] Tách user inbox và shop inbox
  - Backend đã có scope `main` và `workspace`.
- [ ] FE chat workspace/inbox
  - Repo hiện tại là backend; chưa cập nhật FE UI/route để sử dụng scope mới.

## 3. `phanquyen.md`

Trạng thái: chưa fix.

- [x] Role trên user
  - User/auth dùng `roles[]`.
- [x] System permission theo role DB
  - Có `requirePermissions(...)`, `Role`, `Permission`, RBAC seed.
- [x] Shop staff permission theo shop
  - Có `staffPermissions` và `requireShopPermission(...)`.
- [x] `GET /admin/rbac/permissions`
  - Có trong `src/routes/admin/rbac.route.js`.
- [x] `GET /admin/rbac/roles`
  - Có trong `src/routes/admin/rbac.route.js`.
- [ ] Permission metadata cho matrix
  - Chưa có `label`, `group`, `scope`, `sensitivity`, `visibleInMatrix`.
- [ ] Capability grouping/business matrix config
  - Chưa có endpoint/config capability.
- [ ] Category permission
  - `src/routes/category/category.route.js` create/update/delete chỉ `authenticate`, chưa `requirePermissions(...)`.
  - Constants chưa có `admin:manage_categories`.
- [ ] Rule admin không tự sửa role của chính mình
  - `assignRolesToUser(userId, roles)` chưa nhận current admin context và chưa check self-edit.
- [ ] Session/capability snapshot
  - Login/refresh đã trả user DTO tốt hơn, nhưng chưa có `systemPermissions`.
- [ ] Permission label/group/scope cho FE matrix
  - Role model có `name`, `description`, nhưng permission metadata còn thiếu.

## Tổng kết

### Đã xong

- [x] `GET /combos/options`
- [x] Cart server-driven: `GET /cart`, update item, delete item, clear cart.
- [x] `POST /cart/checkout` tạo order từ cart và xóa item đã checkout.
- [x] Filter/options cho products/orders/admin users/shops/KYC/withdrawals.
- [x] `GET /payments/options`.
- [x] Chuẩn hóa DTO `user`.
- [x] Product image contract có `isPrimary`.
- [x] Combo generate/alternatives.
- [x] Payment callback/topup callback.
- [x] Notification cơ bản.
- [x] Product upload/create/add image/remove image/visual assets.
- [x] RBAC role/permission cơ bản.
- [x] Shop staff permission cơ bản.
- [x] Shop conversation có `shopId/customerId`.
- [x] Chat actor `USER/SHOP`, `actingAs`, `senderType`, `senderShopId`.
- [x] List inbox chat theo `scope/shopId`.
- [x] Socket chat có actor shop.

### Chưa xong / cần làm tiếp

- [ ] Single payment URL cho checkout nhiều order.
- [ ] FE chat workspace/inbox.
- [ ] Category permission.
- [ ] Permission metadata cho matrix.
- [ ] Capability/session snapshot.
- [ ] Chặn admin tự sửa role của mình.
- [ ] Label tiếng Việt cho options nếu FE yêu cầu.

## Test đã chạy sau đợt fix

- [x] `node --check` các route/service/controller/model/validation chính đã sửa.
- [x] `npm.cmd test -- tests/integration/cart-order-payment.test.js --runInBand`: pass, 6/6.
- [x] `npm.cmd test -- tests/integration/product-shop.test.js --runInBand`: pass, 8/8.
- [x] `npm.cmd test -- tests/integration/auth-rbac.test.js --runInBand`: pass, 7/7.
- [x] `npm.cmd test -- tests/integration/notification-chat.test.js --runInBand`: pass, 8/8.
- [x] `git diff --check`: pass, chỉ có warning LF/CRLF của Git trên Windows.

## Gợi ý thứ tự làm tiếp

- [ ] Chốt flow thanh toán multi-order checkout: payment group/checkout session hay FE thanh toán từng order.
- [ ] Fix category permission.
- [x] Sửa chat actor shop backend.
- [ ] Cập nhật FE chat workspace nếu làm trong repo FE.
- [ ] Mở rộng RBAC permission metadata/capability snapshot.
