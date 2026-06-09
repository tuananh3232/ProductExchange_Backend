# Checklist tong hop trang thai `Note/bug`

Ngay cap nhat: 2026-06-08

Quy uoc:

- [x] Da co / da fix xong.
- [ ] Chua co / chua xong / moi xu ly mot phan, can lam tiep.

Ghi chu scope dot fix:

- [x] Da xu ly cac muc trong `Note/bug/be_improvements_report.md`.
- [x] Da xu ly backend cac muc trong `Note/bug/chat_shop.md`.
- [ ] Chua xu ly `Note/bug/phanquyen.md`.

## 1. `be_improvements_report.md`

### Combo

- [x] `POST /combos/generate`
  - Co trong `src/routes/combo/combo.route.js`.
- [x] `GET /combos/alternatives`
  - Co trong `src/routes/combo/combo.route.js`.
- [x] `GET /combos/options`
  - Da them `router.get('/options', optionsController.getComboOptions)`.
  - Data lay tu `src/services/options/options.service.js` va combo constants.

### Cart Server-Driven

- [x] `POST /cart/add-combo`
  - Da co tu truoc, van giu backward compatible.
  - Response cart nay co `items`, `totalItems`, `subtotal`.
- [x] `GET /cart`
  - Da them trong `src/routes/cart/cart.route.js`.
- [x] `PATCH /cart/items/:productId`
  - Da them validate ObjectId va Joi `quantity >= 1`.
- [x] `DELETE /cart/items/:productId`
  - Da them xoa item theo productId.
- [x] `DELETE /cart`
  - Da them clear toan bo cart.

### Checkout

- [x] `POST /cart/checkout`
  - Da them tao order tu cart.
  - Validate cart rong, product active/available, stock, self-order, listing type.
  - Xoa item da checkout khoi cart sau khi tao order.
- [ ] Single payment URL cho checkout nhieu order
  - Hien model payment dang gan 1 payment voi 1 order.
  - Neu checkout 1 order voi `PAYOS`/`VNPAY` thi co `paymentUrl`.
  - Neu checkout nhieu order thi `paymentUrl` la `null`; can chot them checkout session/payment group neu FE muon thanh toan mot link cho nhieu order.

### Metadata / Filter Options

- [x] `GET /products/filter-options`
  - Co trong `src/routes/product/product.route.js`.
- [x] `GET /orders/filter-options`
  - Co trong `src/routes/order/order.route.js`.
- [x] `GET /admin/users/filter-options`
  - Co trong `src/routes/admin/admin.route.js`.
  - Giu `authenticate` va `requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS)`.
- [x] `GET /shops/filter-options`
  - Co trong `src/routes/shop/shop.route.js`.
- [x] `GET /kyc/filter-options`
  - Co route `src/routes/options/kyc.route.js`, mount tai `/kyc`.
- [x] `GET /withdrawals/filter-options`
  - Co route `src/routes/options/withdrawal.route.js`, mount tai `/withdrawals`.
- [x] `GET /payments/options`
  - Co trong `src/routes/payment/payment.route.js`.
- [ ] Label tieng Viet cho options
  - Hien dang dung label tieng Anh ASCII de tranh loi encoding/mojibake.
  - FE co the dung tam hoac yeu cau doi sang label tieng Viet sau.

### User DTO

- [x] Chuan hoa `toUserResponse()`
  - Co cac field: `id`, `email`, `name`, `fullName`, `avatarUrl`, `avatar`, `phone`, `address`, `roles`, `primaryRole`, `status`, `isActive`, `isVerified`, `createdAt`, `updatedAt`.
- [x] Login/register dung DTO chung
  - Controller auth dung `toUserResponse()`.
- [x] Refresh token tra user DTO chung
  - `src/services/auth/auth.service.js` da tra `user` trong refresh result.
- [x] `GET /users/me` dung DTO chung
  - `src/controllers/user/user.controller.js` dung `toUserResponse(user)`.
- [x] Update profile tra user DTO
  - `src/controllers/user/user.controller.js` tra `data: { user: toUserResponse(user) }`.

### Product Media / Upload Contract

- [x] Image item co `isPrimary`
  - `src/models/product.model.js` them `images.isPrimary`.
- [x] Default primary cho anh dau tien neu data cu chua co primary
  - Product repository/service normalize image dau tien la primary.
- [x] Add image moi tu set primary neu product chua co primary
  - `src/services/product/product.service.js`.
- [x] Remove image primary thi set anh con lai dau tien lam primary
  - `src/services/product/product.service.js`.
- [x] Update product JSON images giu contract `{ url, publicId, isPrimary }`
  - `src/validations/product/product.validation.js` va product service da xu ly.

### Cac nen tang da co tu truoc

- [x] Notification co ban.
- [x] Payment callback/topup callback.
- [x] Room visualizer.
- [x] Product visual assets.

## 2. `chat_shop.md`

Trang thai: da fix backend theo `Note/fixBug/fix-chat-shop.md`.

- [x] Conversation loai shop co `shopId`, `customerId`
  - `Conversation` model co `type: SHOP`, `shopId`, `customerId`, `shopCustomerKey`.
- [x] Tao conversation shop tu storefront
  - `POST /conversations/shop` nhan `shopId`.
- [x] ACL chat shop co actor shop
  - `assertConversationActorAccess()` chan dung theo `actingAs=USER/SHOP`.
  - Customer chi gui duoc `USER`; owner/staff co `shop:chat_manage` moi gui duoc `SHOP`.
- [x] List conversation theo `scope=main/workspace&shopId=...`
  - `GET /conversations?scope=main` tra inbox ca nhan.
  - `GET /conversations?scope=workspace&shopId=...` tra inbox shop workspace.
- [x] Send message voi `actingAs: USER/SHOP`
  - Validation/controller/service da nhan `actingAs` va `shopId`.
- [x] Message model co `senderType`, `senderShopId`, `senderUserId`
  - `src/models/message.model.js` da them actor fields.
- [x] `lastMessage` luu actor shop/user
  - `Conversation.lastMessage` da co `senderType`, `senderUserId`, `senderShopId`, `createdAt`.
- [x] Socket event tra actor shop/user
  - `send_message` di qua service chung.
  - `typing_start/typing_stop` emit them `actingAs` va `shopId`.
- [x] Chan reply sai shop khi `actingAs=SHOP`
  - Service kiem tra `shopId` phai khop conversation va user phai co quyen chat shop do.
- [x] Tach user inbox va shop inbox
  - Backend da co scope `main` va `workspace`.
- [ ] FE chat workspace/inbox
  - Repo hien tai la backend; chua cap nhat FE UI/route de su dung scope moi.

## 3. `phanquyen.md`

Trang thai: chua fix.

- [x] Role tren user
  - User/auth dung `roles[]`.
- [x] System permission theo role DB
  - Co `requirePermissions(...)`, `Role`, `Permission`, RBAC seed.
- [x] Shop staff permission theo shop
  - Co `staffPermissions` va `requireShopPermission(...)`.
- [x] `GET /admin/rbac/permissions`
  - Co trong `src/routes/admin/rbac.route.js`.
- [x] `GET /admin/rbac/roles`
  - Co trong `src/routes/admin/rbac.route.js`.
- [ ] Permission metadata cho matrix
  - Chua co `label`, `group`, `scope`, `sensitivity`, `visibleInMatrix`.
- [ ] Capability grouping/business matrix config
  - Chua co endpoint/config capability.
- [ ] Category permission
  - `src/routes/category/category.route.js` create/update/delete chi `authenticate`, chua `requirePermissions(...)`.
  - Constants chua co `admin:manage_categories`.
- [ ] Rule admin khong tu sua role cua chinh minh
  - `assignRolesToUser(userId, roles)` chua nhan current admin context va chua check self-edit.
- [ ] Session/capability snapshot
  - Login/refresh da tra user DTO tot hon, nhung chua co `systemPermissions`.
- [ ] Permission label/group/scope cho FE matrix
  - Role model co `name`, `description`, nhung permission metadata con thieu.

## Tong ket

### Da xong

- [x] `GET /combos/options`
- [x] Cart server-driven: `GET /cart`, update item, delete item, clear cart.
- [x] `POST /cart/checkout` tao order tu cart va xoa item da checkout.
- [x] Filter/options cho products/orders/admin users/shops/KYC/withdrawals.
- [x] `GET /payments/options`.
- [x] Chuan hoa DTO `user`.
- [x] Product image contract co `isPrimary`.
- [x] Combo generate/alternatives.
- [x] Payment callback/topup callback.
- [x] Notification co ban.
- [x] Product upload/create/add image/remove image/visual assets.
- [x] RBAC role/permission co ban.
- [x] Shop staff permission co ban.
- [x] Shop conversation co `shopId/customerId`.
- [x] Chat actor `USER/SHOP`, `actingAs`, `senderType`, `senderShopId`.
- [x] List inbox chat theo `scope/shopId`.
- [x] Socket chat co actor shop.

### Chua xong / can lam tiep

- [ ] Single payment URL cho checkout nhieu order.
- [ ] FE chat workspace/inbox.
- [ ] Category permission.
- [ ] Permission metadata cho matrix.
- [ ] Capability/session snapshot.
- [ ] Chan admin tu sua role cua minh.
- [ ] Label tieng Viet cho options neu FE yeu cau.

## Test da chay sau dot fix

- [x] `node --check` cac route/service/controller/model/validation chinh da sua.
- [x] `npm.cmd test -- tests/integration/cart-order-payment.test.js --runInBand`: pass, 6/6.
- [x] `npm.cmd test -- tests/integration/product-shop.test.js --runInBand`: pass, 8/8.
- [x] `npm.cmd test -- tests/integration/auth-rbac.test.js --runInBand`: pass, 7/7.
- [x] `npm.cmd test -- tests/integration/notification-chat.test.js --runInBand`: pass, 8/8.
- [x] `git diff --check`: pass, chi co warning LF/CRLF cua Git tren Windows.

## Goi y thu tu lam tiep

- [ ] Chot flow thanh toan multi-order checkout: payment group/checkout session hay FE thanh toan tung order.
- [ ] Fix category permission.
- [x] Sua chat actor shop backend.
- [ ] Cap nhat FE chat workspace neu lam trong repo FE.
- [ ] Mo rong RBAC permission metadata/capability snapshot.
