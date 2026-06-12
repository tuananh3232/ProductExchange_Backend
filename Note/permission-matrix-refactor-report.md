# Bao cao refactor Permission/RBAC theo permission matrix

## 1. Muc tieu

Refactor he thong Permission/RBAC theo ma tran quyen chi tiet, tach ro user/member, seller ca nhan, shop owner, shop-scoped staff va admin. Admin full quyen bang role `admin`, khong can permission `admin:*`. Auth login/logout/register khong nam trong permission matrix.

## 2. File da sua

- `src/constants/permission.constant.js`
- `src/middlewares/auth.middleware.js`
- `src/services/rbac/rbac-seed.service.js`
- `src/services/rbac/rbac.service.js`
- `src/routes/admin/admin.route.js`
- `src/routes/admin/rbac.route.js`
- `src/routes/admin/stats.route.js`
- `src/routes/auth/auth.route.js`
- `src/routes/cart/cart.route.js`
- `src/routes/category/category.route.js`
- `src/routes/notification/notification.route.js`
- `src/routes/product/product.route.js`
- `src/routes/seller/seller.route.js`
- `src/routes/shop/shop.route.js`
- `src/routes/shop/shop-invitation.route.js`
- `src/routes/user/user.route.js`
- `src/routes/user-wallet/user-wallet.route.js`
- `src/routes/wallet/wallet.route.js`
- `src/services/product/product.service.js`
- `src/services/order/order.service.js`
- `src/services/wallet/wallet.service.js`
- `src/services/stats/stats.service.js`
- `src/services/shop/shop.service.js`
- `src/services/shop/shop-invitation.service.js`
- `src/services/conversation/conversation.service.js`
- `src/services/visual-assets/product-visual.service.js`
- `src/validations/shop/shop.validation.js`
- `tests/integration/product-shop.test.js`
- `tests/integration/chat-shop-actor.test.js`
- `tests/unit/conversation.service.unit.test.js`

## 3. Permission cu deprecated

Cac permission cu van giu trong constant de tuong thich import/du lieu cu, nhung khong con duoc seed vao matrix moi va khong con dung trong route chinh:

- `auth:register`, `auth:login`, `auth:logout`
- `product:create`, `product:read`, `product:update`, `product:delete`
- `user:read`, `user:update`
- `shop:create`, `shop:read`, `shop:update`, `shop:view_stats`
- `shop:manage_owner`, `shop:manage_staff`, `shop:manage_staff_permissions`, `shop:chat_manage`
- `order:create`, `order:read`, `order:confirm`, `order:cancel`, `order:update_status`
- `wallet:view`, `wallet:request_withdrawal`
- `admin:manage_users`, `admin:manage_products`, `admin:manage_shops`, `admin:manage_roles`, `admin:manage_permissions`, `admin:view_stats`, `admin:manage_withdrawals`
- `product_visual_asset:manage`

## 4. Permission moi da them

Member/user:

- `user:self:read`, `user:self:update`
- `user:cart:read`, `user:cart:update`, `user:cart:clear`, `user:cart:checkout`
- `user:order:create`, `user:order:read`, `user:order:cancel`
- `notification:self:read`, `notification:self:update`, `notification:self:delete`

Seller:

- `seller:product:read`, `seller:product:create`, `seller:product:update`, `seller:product:delete`, `seller:product:update_status`, `seller:product:image_update`
- `seller:order:read`, `seller:order:confirm`, `seller:order:cancel`, `seller:order:update_status`
- `wallet:self:read`, `wallet:self_transaction:read`, `wallet:withdrawal:create`, `wallet:withdrawal:read`

Shop:

- `shop:profile:read`, `shop:profile:update`, `shop:profile:submit_review`
- `shop:stats:read`
- `shop:owner:transfer`
- `shop:product:read`, `shop:product:create`, `shop:product:update`, `shop:product:delete`, `shop:product:update_status`, `shop:product:image_update`, `shop:product:visual_asset_manage`
- `shop:order:read`, `shop:order:confirm`, `shop:order:cancel`, `shop:order:update_status`
- `shop:staff:read`, `shop:staff:invite`, `shop:staff:remove`
- `shop:staff_permission:read`, `shop:staff_permission:update`
- `shop:chat:read`, `shop:chat:send`, `shop:chat:mark_read`
- `shop:wallet:read`, `shop:wallet_transaction:read`, `shop:withdrawal:create`, `shop:withdrawal:read`

Khac:

- `room_visualizer:use`

## 5. Role matrix moi

- `member`: user self, cart, own order, notification, personal wallet basic permissions.
- `seller`: member permissions + seller product/order + personal wallet withdrawal permissions.
- `shop_owner`: member permissions + full shop permission set. Trong shop cua minh owner van duoc bypass boi `assertShopPermission`.
- `staff`: chi seed member permissions. Quyen shop cua staff nam trong `shop.staffPermissions` theo tung shop.
- `admin`: role full access. Middleware `requirePermissions`, `requireRoles`, `requireShopPermission`/`assertShopPermission` bypass theo role `admin`.

## 6. Staff permission whitelist

API invite/update staff chi chap nhan `SHOP_STAFF_PERMISSIONS`:

- `shop:profile:read`, `shop:profile:update`
- `shop:stats:read`
- `shop:product:read`, `shop:product:create`, `shop:product:update`, `shop:product:delete`, `shop:product:update_status`, `shop:product:image_update`, `shop:product:visual_asset_manage`
- `shop:order:read`, `shop:order:confirm`, `shop:order:cancel`, `shop:order:update_status`
- `shop:staff:read`, `shop:staff:invite`, `shop:staff:remove`
- `shop:staff_permission:read`
- `shop:chat:read`, `shop:chat:send`, `shop:chat:mark_read`
- `shop:wallet:read`, `shop:wallet_transaction:read`, `shop:withdrawal:read`

Khong whitelist `shop:owner:transfer`, `shop:staff_permission:update`, `shop:withdrawal:create`, `admin:*`, `seller:*`, `user:*`.

## 7. Route mapping da cap nhat

- Admin routes: check role `admin`, khong dung `admin:manage_*`.
- Auth logout: chi `authenticate`, khong dung `auth:logout`.
- User profile/KYC: `user:self:read`, `user:self:update`.
- Cart: `user:cart:read/update/clear/checkout`.
- Notification: `notification:self:read/update/delete`.
- User wallet: `wallet:self:read`, `wallet:self_transaction:read`, `wallet:withdrawal:create/read`.
- Shop wallet: `shop:wallet:read`, `shop:wallet_transaction:read`, `shop:withdrawal:create/read` theo shop id.
- Shop staff/invitation: `shop:staff:read/invite/remove`, `shop:staff_permission:read/update`.
- Shop product route/service: `shop:product:*` theo shop id.
- Seller route/service: seller ownership/role cho tai nguyen seller, route seller list dung `seller:product:read`.
- Shop chat: `shop:chat:read` de doc/list, `shop:chat:send` de gui voi actor SHOP.
- Visual asset: `shop:product:visual_asset_manage`.

## 8. Test da chay

Da chay thanh cong:

```text
TEST_DB_NAME=anhdecor_test npm.cmd test -- --runInBand tests/unit/conversation.service.unit.test.js
```

Ket qua:

```text
PASS tests/unit/conversation.service.unit.test.js
36 passed
```

Da chay `git diff --check`: khong co whitespace error, chi co warning line ending LF/CRLF cua Git tren Windows.

Da chay eslint targeted cho subset cac file source sach/chinh trong pham vi sua:

```text
.\node_modules\.bin\eslint.cmd src/services/shop/shop.service.js src/services/rbac/rbac.service.js src/services/visual-assets/product-visual.service.js src/constants/permission.constant.js src/middlewares/auth.middleware.js
```

Ket qua: pass cho subset tren.

## 9. Loi/tồn đọng

Integration tests chua chay duoc trong moi truong hien tai vi hook ket noi test DB timeout truoc khi vao test case:

```text
Exceeded timeout of 30000 ms for a hook
tests/setup/jest.setup-after-env.js beforeAll connectTestDB/ensureRbacSeedData
```

Lan chay dau tien khong set `TEST_DB_NAME` bi chan dung:

```text
Refusing to run tests on non-test database: anhdecor. TEST_DB_NAME must end with _test.
```

`npm run lint` toan project van fail do nhieu file cu co semicolon theo rule `semi`; day la ton dong san co ngoai pham vi refactor. Cac file source chinh trong pham vi da duoc eslint targeted pass.

## 10. Migration/backward compatibility

- Khong doi ten role `staff`; trong bao cao hieu la staff shop.
- Khong drop collection, khong xoa permission cu khoi database.
- Permission cu giu trong constant `DEPRECATED_PERMISSIONS` de tranh vo import/du lieu cu.
- Seed RBAC moi chi seed `ACTIVE_PERMISSION_KEYS`; admin role co permissions rong va bypass bang role.
- API update role permission chi chap nhan permission nam trong matrix moi.
- Staff permission API chi chap nhan `SHOP_STAFF_PERMISSIONS`.

## 11. Reset RBAC permission data on anhdecor

Da them va chay script an toan:

```text
scripts/reset-rbac-permissions.js
```

DB da reset:

- `anhdecor`

Collection da reset:

- `permissions`: xoa toan bo document permission cu/moi dang lan, seed lai permission moi tu `ACTIVE_PERMISSION_KEYS`.
- `roles.permissions`: clear permission ObjectId trong tat ca role, seed lai theo `ROLE_PERMISSION_MAP`.

Ket qua reset that tren `anhdecor`:

- So permission truoc reset: 87.
- So permission deprecated truoc reset: 32.
- So permission cu da xoa cung collection reset: 87 documents trong `permissions`.
- So permission moi da seed: 55/55.
- Deprecated permission con lai trong collection `permissions`: 0.
- `roles.permissions` da clear va seed lai: matched 5 roles, modified 5 roles.
- Admin permissions empty: true.
- Admin full access: bang role bypass trong middleware/service, khong dung `admin:*`.
- Shop documents scanned: 2.
- Shop documents updated: 0.
- Invitation documents scanned: 0.
- Invitation documents updated: 0.
- Deprecated permission con lai o field khac: 0.
- Invalid staff permission con lai sau cleanup plan: 0.
- Staff permissions chi con nam trong `SHOP_STAFF_PERMISSIONS`: true.

Audit field permission:

- `roles.permissions`: ton tai; ObjectId reference den `Permission`.
- `shop.staffPermissions[].permissions`: ton tai; string permissions, duoc audit/cleanup boi script.
- `shop.staffs.permissions`: khong ton tai trong `Shop` model hien tai.
- `shop.members.permissions`: khong ton tai trong `Shop` model hien tai.
- `shopInvitations.permissions`: ton tai; string permissions, duoc audit/cleanup boi script.
- `users.permissions`: khong ton tai trong `User` model hien tai.
- `memberPermissions`: khong ton tai trong cac model hien tai.

Cleanup da xu ly:

- Shop staff permission: scanned 2, affected 0, updated 0.
- Shop invitation permission: scanned 0, affected 0, updated 0.
- Khong co permission can map.
- Khong co permission can remove.
- Khong con deprecated permission trong shop staff/invitation fields.

Role matrix sau reset:

- `admin`: 0 permissions.
- `member`: 15 permissions, khong co `wallet:withdrawal:create`.
- `staff`: 15 permissions, khong co `wallet:withdrawal:create`, khong co `seller:*`, `shop:*`, `admin:*`.
- `seller`: 26 permissions, co `wallet:withdrawal:create`.
- `shop_owner`: 43 permissions, member permissions + full shop permissions.

Muc dich script:

- Xoa va seed lai rieng RBAC permission data sau refactor permission matrix.
- Khong dung `dropDatabase`.
- Khong xoa collection nghiep vu nhu users, shops, products, orders, wallets, conversations.
- Chi tac dong:
  - Collection `permissions`: xoa tat ca permission cu, sau do seed lai `ACTIVE_PERMISSION_KEYS`.
  - Collection `roles`: clear mang `permissions`, sau do `ensureRbacSeedData()` gan lai permission theo `ROLE_PERMISSION_MAP`.
- Du an khong co collection mapping `role_permissions` rieng; mapping hien nam trong `roles.permissions`.
- Audit/cleanup them `shop.staffPermissions[].permissions` va `shopInvitations.permissions`.

Guard an toan:

- Chan `NODE_ENV=production`.
- Bat buoc set `ALLOW_RBAC_RESET=true`.
- Chan cac DB name nguy hiem: `anhdecor`, `productexchange`, `prod`, `production`.
- Rieng `anhdecor` mac dinh van bi chan, chi cho chay khi co them `ALLOW_BLOCKED_DB_RBAC_RESET=true` va `NODE_ENV=development`.
- Chi cho chay tren whitelist DB:
  - `anhdecor_test`
  - `anhdecor_dev`
  - `productexchange_test`
  - `productexchange_dev`
  - `product_dev`
  - `product_local`
- Truoc khi reset, script in `NODE_ENV`, DB name va Mongo URI da mask password.
- Sau khi connect, script doi chieu DB dang ket noi voi DB name du kien de tranh reset nham.
- Khi chay tren `anhdecor`, script log canh bao:

```text
WARNING: resetting RBAC permission data on blocked DB: anhdecor
```

Audit mode:

```text
RBAC_AUDIT_ONLY=true
```

- Khong update DB.
- Chi scan/report `permissions`, `roles.permissions`, `shop.staffPermissions[].permissions`, `shopInvitations.permissions`.
- Bao cao permission se duoc map/xoa neu cleanup that.

Lenh chay mau:

```text
DB_NAME=anhdecor_dev ALLOW_RBAC_RESET=true node scripts/reset-rbac-permissions.js
```

Tren PowerShell:

```text
$env:DB_NAME='anhdecor_dev'; $env:ALLOW_RBAC_RESET='true'; node scripts/reset-rbac-permissions.js
```

Lenh audit da chay tren `anhdecor`:

```text
$env:NODE_ENV='development'; $env:DB_NAME='anhdecor'; $env:ALLOW_RBAC_RESET='true'; $env:ALLOW_BLOCKED_DB_RBAC_RESET='true'; $env:RBAC_AUDIT_ONLY='true'; node scripts\reset-rbac-permissions.js
```

Lenh reset that da chay tren `anhdecor`:

```text
$env:NODE_ENV='development'; $env:DB_NAME='anhdecor'; $env:ALLOW_RBAC_RESET='true'; $env:ALLOW_BLOCKED_DB_RBAC_RESET='true'; $env:RBAC_AUDIT_ONLY='false'; node scripts\reset-rbac-permissions.js
```

Output bao cao sau reset gom:

- So permission da xoa.
- So role da clear permission truoc khi seed lai.
- So active permission moi da seed.
- So deprecated permission con ton tai trong collection `permissions`.
- Role permission matrix sau seed.
- Xac nhan admin co permissions rong.
- Ghi ro admin full access bang role bypass trong middleware, khong phai bang `admin:*`.

Test/verify da chay:

```text
node --check scripts\reset-rbac-permissions.js
.\node_modules\.bin\eslint.cmd scripts/reset-rbac-permissions.js src/constants/permission.constant.js
git diff --check -- scripts/reset-rbac-permissions.js Note/permission-matrix-refactor-report.md
```

Loi/ton dong:

- Lan audit dau tien trong sandbox bi timeout khi connect MongoDB Atlas; da chay lai voi network approval va audit pass.
