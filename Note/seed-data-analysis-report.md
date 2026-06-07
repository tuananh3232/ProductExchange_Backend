# Bao cao ra soat seed data ProductExchange_Backend

Ngay lap: 2026-06-03

Pham vi thuc hien:
- Da doc `Note/make-seed.md`, `src/models/*.js`, `src/constants/*.js`, route, service chinh, test va seed hien co.
- Khong sua business logic.
- Khong tao seed file moi.
- Khong xoa, update hoac ghi database.
- Khong chay `npm run seed`.

## A. Tong quan data hien tai

Project dung Mongoose, cac collection/model quan trong:
- `users`: tai khoan, role, KYC, verify email, soft active.
- `roles`, `permissions`: RBAC.
- `shops`, `shopinvitations`: shop owner/staff/onboarding.
- `categories`, `products`: catalog, ownerType SHOP/SELLER, decor metadata cho combo.
- `carts`: gio hang 1 user 1 cart.
- `orders`, `payments`: order/payment gateway.
- `wallets`, `wallettransactions`, `withdrawalrequests`: vi shop va rut tien shop.
- `userwallets`, `userwallettransactions`, `userwallettopups`, `userwalletwithdrawals`: vi ca nhan user.
- `notifications`: thong bao gan user va target.
- `conversations`, `messages`: chat direct/shop.

Collection can co seed uu tien:
- Bat buoc cho flow test/demo: `users`, `roles`, `permissions`, `categories`, `shops`, `products`, `carts`, `orders`, `payments`, `wallets`, `userwallets`, `notifications`.
- Nen co them neu demo day du: `shopinvitations`, `wallettransactions`, `withdrawalrequests`, `userwallettransactions`, `userwallettopups`, `userwalletwithdrawals`, `conversations`, `messages`.
- Chua thay model review/feedback rieng trong source hien tai; notification constants co review types nhung khong co review model/service.

## B. Model map

### User
- Collection: `users`; timestamps: co; soft delete/active: `isActive`.
- Required: `name`, `email`, `password`.
- Optional/default: avatar, phone, address, `roles=["member"]`, `isVerified=false`, email/reset token fields, refreshToken, rating, KYC.
- Enum: roles `member`, `admin`, `seller`, `shop_owner`, `staff`; KYC `none`, `pending`, `approved`, `rejected`.
- Unique/index: `email` unique.
- Note seed: user dang nhap duoc can `isVerified=true`, `emailVerifiedAt` co gia tri, `isActive=true`; password se duoc hash qua pre-save neu tao bang Mongoose.

### Role / Permission
- `roles`: `code` required unique enum role, `name` required, `permissions[]` ref `Permission`, `isActive=true`, timestamps.
- `permissions`: `key` required unique lowercase, `description`, `module`, `isActive=true`, timestamps.
- Note seed: nen chay/dua logic RBAC truoc khi tao flow permission-sensitive.

### Shop
- Collection: `shops`; timestamps: co; soft active: `isActive`.
- Required: `name`, `slug`, `owner`.
- Optional/default: description, logo, phone, email, address, staff, staffPermissions, `status=draft`, rejectionReason.
- Enum status: `draft`, `pending_review`, `active`, `rejected`, `suspended`.
- Ref: `owner -> User`, `staff[] -> User`, `staffPermissions.staffUser -> User`.
- Unique/index: `slug` unique; index owner/status/staff/isActive/text.
- Note seed: shop public va tao product shop duoc can `status=active`, `isActive=true`. Submit/approve flow can owner co KYC approved.

### ShopInvitation
- Collection: `shopinvitations`; required: `shop`, `invitee`, `inviter`.
- Enum: role `STAFF`, `MANAGER`; status `pending`, `accepted`, `rejected`, `expired`.
- Ref: shop/user; timestamps co.
- Note seed: invitee hop le nen co role `member`, khong phai admin, khong phai owner cua shop hien tai.

### Category
- Collection: `categories`; required unique: `name`, `slug`.
- Optional/default: description, icon, `isActive=true`; timestamps co.
- Note seed: products required category, nen tao category truoc product.

### Product
- Collection: `products`; timestamps: co; soft active: `isActive`.
- Required: `title`, `description`, `price`, `listingType`, `condition`, `category`, `owner`, `ownerType`.
- Optional/default: `stock=1`, images, shop, seller, location, `status=available`, views, decor fields, comboPriority.
- Enum: `listingType=sell`; condition `new`, `like_new`, `good`, `fair`, `poor`; status `available`, `pending`, `sold`, `hidden`; ownerType `SHOP`, `SELLER`; style/roomType/colorTone/decorRole theo combo constants.
- Ref: `category -> Category`, `owner/seller -> User`, `shop -> Shop`.
- Index: text title/description, category/status, owner, shop/status, seller/status, ownerType/status, listingType/status, `isActive,status,stock,decorRole,price`.
- Dieu kien hop le cho public/cart/combo/order: `isActive=true`, `status=available`, `stock>0`; cart/order hien khong tru stock ma dung status va stock check.
- Note ownership: ownerType `SHOP` bat buoc co `shop` va khong co `seller`; ownerType `SELLER` bat buoc co `seller` va khong co `shop`.

### Cart
- Collection: `carts`; required: `user` unique; items default empty.
- Item required: `product`, `quantity>=1`, `unitPrice>=0`.
- Ref: `user -> User`, `items.product -> Product`; timestamps co.
- Note seed: chi nen gan product available/active/stock du so luong; `unitPrice` nen lay gia DB tai thoi diem add.

### Order
- Collection: `orders`; timestamps: co; soft active: `isActive`.
- Required: `buyer`, `product`, `unitPrice`, `totalAmount`.
- Optional/default: shop, seller, `quantity=1`, shippingAddress, note, `status=pending`, `paymentStatus=unpaid`, payment fields, history.
- Enum order: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- Enum paymentStatus: `unpaid`, `pending_payment`, `paid`, `failed`, `cancelled`, `refund_pending`.
- Ref: buyer/seller/history.updatedBy -> User, shop -> Shop, product -> Product.
- Note seed: order tao hop le can buyer khac owner product; product status available luc tao; sau tao order product se bi set `pending`. Confirm can `paymentStatus=paid`. Delivered se set product `sold` va credit vi shop neu paid.

### Payment
- Collection: `payments`; required: `order`, `buyer`, `amount`, `transactionRef`.
- Unique/index: `order` unique, `transactionRef` unique, buyer/provider/status indexes.
- Enum status dung chung `PAYMENT_STATUS`.
- Note seed: payment gan 1-1 voi order; amount phai khop `order.totalAmount`; neu paid nen dong bo `Order.paymentStatus=paid`, `paymentRef`, `paidAt`.

### Wallet / WalletTransaction / WithdrawalRequest
- `wallets`: required unique `shop`; balances default 0; `isActive=true`.
- `wallettransactions`: required `wallet`, `shop`, `type`, `grossAmount`, `netAmount`; type `credit|debit`; status `pending|completed|failed`; optional order.
- `withdrawalrequests`: required `shop`, `wallet`, `requestedBy`, `amount`, bankInfo; status `pending`, `approved`, `rejected`, `processing`, `completed`.
- Note seed: shop wallet co the khong ton tai, service tra zero-balance; nhung seed chuan nen tao wallet cho shop active.

### UserWallet / UserWalletTransaction / UserWalletTopup / UserWalletWithdrawal
- `userwallets`: required unique `user`; balance totals default 0; `isActive=true`.
- `userwallettransactions`: required wallet/user/type/amount; type `topup`, `payment`, `refund`, `withdrawal`; status `pending`, `completed`, `failed`; optional order/topup.
- `userwallettopups`: required user/wallet/amount/transactionRef/orderCode; status `pending`, `completed`, `failed`, `cancelled`; provider default `payos`.
- `userwalletwithdrawals`: required user/wallet/amount/bankInfo; withdrawal status dung chung.
- Note seed: user wallet payment can order `status=pending`, `paymentStatus=unpaid`, buyer dung user, balance du.

### Notification
- Collection: `notifications`; required: recipient, type, title, message.
- Optional/default: sender, data, targetType=`SYSTEM`, targetId, actionUrl, priority=`NORMAL`, channels=`IN_APP`, `isRead=false`.
- Ref: recipient/sender -> User.
- Enum: type theo `NOTIFICATION_TYPES`; targetType `USER|SHOP|PRODUCT|ORDER|PAYMENT|CHAT|REVIEW|REPORT|VOUCHER|SYSTEM`; priority `LOW|NORMAL|HIGH|URGENT`; channels `IN_APP|EMAIL|PUSH|SOCKET`.

### Conversation / Message
- `conversations`: required type `DIRECT|SHOP`; participants, participantKey/shopCustomerKey unique partial; shopId/customerId optional; lastMessage; `isActive=true`.
- `messages`: required `conversationId`, `senderId`; messageType `TEXT|IMAGE|FILE`; attachments/readBy arrays.
- Note seed: direct conversation can use participantKey; shop conversation can use shopCustomerKey, shopId, customerId.

## C. Relationship map

- User 1-n Shop as owner.
- User n-n Shop as staff through `shops.staff` and `staffPermissions`.
- Shop 1-n Product for `ownerType=SHOP`.
- User 1-n Product for `ownerType=SELLER`.
- Category 1-n Product.
- User 1-1 Cart; Cart n-1 Product.
- User 1-n Order as buyer.
- Shop 1-n Order for shop products; User 1-n Order as seller for personal seller products.
- Product 1-n Order historically, but product status makes active sale close after pending/sold.
- Order 1-1 Payment.
- Shop 1-1 Wallet; Wallet 1-n WalletTransaction; Wallet 1-n WithdrawalRequest.
- User 1-1 UserWallet; UserWallet 1-n UserWalletTransaction/Topup/Withdrawal.
- User 1-n Notification as recipient/sender; notification target can point to shop/product/order/payment/chat/etc.
- Conversation 1-n Message; direct conversation links users, shop conversation links shop and customer.

## D. Seed data can co

Tai khoan test nen dung chung password, vi du `123456`, va tat ca user dang nhap duoc can `isVerified=true`.

De xuat users:
- 1 admin: roles `["admin"]`.
- 2 customers/members: roles `["member"]`, co address; 1 user co user wallet du tien, 1 user khong du tien.
- 2 seller ca nhan: roles `["member","seller"]`, KYC approved; co product SELLER.
- 2 shop owners: roles `["member","shop_owner"]`, KYC approved; moi owner co shop.
- 1 staff: roles `["member","staff"]`, nam trong staff cua 1 shop va co staffPermissions.
- 1 user KYC pending, 1 user KYC rejected de test admin KYC.
- 1 inactive/banned user de test admin ban/unban/login fail.

De xuat shops:
- 1 active shop day du phone/email/address/logo, owner KYC approved.
- 1 draft shop de test submit review.
- 1 pending_review shop de test approve/reject va lock edit.
- 1 rejected shop de test resubmit/delete.
- 1 suspended shop de test unsuspend/block.

De xuat products:
- Active available products cho cart/order/combo, stock lon hon 5.
- Low-stock products stock 1-5 cho combo availability `low_stock`.
- Out-of-stock products stock 0 cho loi cart/combo.
- Hidden/pending/sold products de test filter va invalid add cart/order.
- Product `ownerType=SHOP` gan shop active.
- Product `ownerType=SELLER` gan seller user.
- Decor metadata du `decorRole`: `main_item`, `lighting`, `wall_decor`, `textile`, `accent_item`, `fragrance`; co style/roomType/colorTone de test combo.
- Moi product nen co category va images `{url, publicId}`.

De xuat commerce data:
- Cart mau cua customer co item available va unitPrice khop product price.
- Order pending unpaid cho payment/pay wallet.
- Order pending paid cho confirm.
- Order confirmed/processing/shipped/delivered/cancelled cho order status flow.
- Payment pending_payment/paid/failed/cancelled gan dung order.
- Wallet shop co balance du rut tien va transaction CREDIT tu order delivered.
- UserWallet co balance du pay-order/topup/withdrawal, transactions topup/payment/refund/withdrawal.
- Withdrawal pending/approved/rejected/completed cho shop wallet va user wallet.
- Notifications read/unread, targetType USER/SHOP/PRODUCT/ORDER/PAYMENT/SYSTEM.
- Conversation direct va shop, kem messages TEXT/IMAGE neu can test chat.

## E. Diem khong dong bo / rui ro hien tai

- `scripts/seed-decor-data.js` dang tao 4 users, category, shop active, products, staff invitation, 2 orders/payment. No chua tao `Cart`, `Wallet`, `UserWallet`, wallet transactions, notifications, conversations/messages.
- Seed hien tai dat 2 product dau thanh `sold` sau khi tao delivered orders. Neu dung lai cung product cho cart/combo/order moi se fail vi khong con `available`.
- Product seed trong `upsertProducts` set `ownerType` khong ro trong payload. Model pre-validate co the suy ra SHOP neu co `shop`, nhung seed chuan nen set explicit `ownerType: "SHOP"` de tranh lech logic khi upsert/update.
- User seed owner chi co roles `["shop_owner"]`, staff chi co `["staff"]`. Mot so service/test yeu cau staff invite target phai co `member`, va seller can role `seller`; seed moi nen giu base `member` kem role nang cao neu flow can.
- Shop approval logic yeu cau owner KYC approved. Seed hien tai tao shop active truc tiep nen khong phuc vu day du flow approve/reject KYC/shop.
- Cart/combo/order yeu cau product `isActive=true`, `status=available`, `stock>0`; cac status `pending/sold/hidden` chi nen dung cho negative/filter test.
- Confirm order yeu cau order da paid. Seed order status delivered/paid co ich cho stats, nhung can them pending unpaid/pending paid de test payment/confirm.
- Payment 1-1 unique theo order. Seed moi can tranh tao nhieu payment cho cung order.
- Wallet shop service co the tra object zero khi chua co wallet document, nhung withdrawal/credit can wallet document; seed demo nen tao wallet ro rang.
- User wallet topup/payment/rut tien co nhieu idempotency theo topup/order; seed transaction can tranh duplicate `order`/`topup` neu service co check.
- Lint hien tai fail do 398 loi `semi` va 9 warning unused vars; day la rui ro chat luong code hien co, khong phai loi seed.
- `npm test -- --runInBand` bi timeout sau 124s trong lan kiem tra nay, nen chua co ket qua pass/fail day du.
- Khong thong ke MongoDB runtime vi khong thuc hien ket noi doc DB trong buoc nay.

## F. De xuat seed moi

Khong nen code seed voi ngay. Nen viet seed moi theo thu tu:
1. Guard moi truong: chi cho phep `NODE_ENV=test|development`, chan production bang confirm/env flag.
2. Connect DB va in database name truoc khi thao tac.
3. Clear an toan trong dev/test: chi clear cac collection duoc liet ke ro, trong transaction/session neu co the; khong drop database production.
4. Tao RBAC: permissions truoc, roles sau.
5. Tao users bang ObjectId co dinh: admin, customers, sellers, shop owners, staff, inactive, KYC cases.
6. Tao categories.
7. Tao shops voi nhieu status; tao staffPermissions va shop invitations.
8. Tao products sau khi co users/shops/categories; explicit ownerType/shop/seller/status/stock/decor fields.
9. Tao carts chi voi product available stock du.
10. Tao orders theo tung scenario; cap nhat product status phu hop voi order scenario.
11. Tao payments gan order; dong bo `order.paymentStatus`, `paymentMethod`, `paymentProvider`, `paymentRef`, `paidAt`.
12. Tao wallets/userWallets; tao transactions/topups/withdrawals phu hop balance.
13. Tao notifications va conversations/messages cuoi cung vi phu thuoc vao user/shop/product/order/payment.
14. In summary collection counts va account test.

ObjectId co dinh nen dung cho:
- Users chinh: admin/customer/seller/shopOwner/staff.
- Categories va shops chinh.
- Products dung cho cart/order/payment/combo.
- Orders/payment/wallet records trong scenario can test idempotency.

Password mac dinh:
- De xuat `123456` cho tat ca account test, hash qua Mongoose pre-save.
- Account dang nhap duoc can `isVerified=true`, `emailVerifiedAt` set.

Quy tac clear database an toan:
- Yeu cau `ALLOW_SEED_RESET=true` neu co clear.
- Tu choi chay neu `NODE_ENV=production` hoac Mongo URI/database name co dau hieu prod.
- In database name va collection se clear truoc khi clear.
- Khong dung seed script de update data prod.

Kiem tra da chay:
- `node --check src/server.js`: pass.
- `npm.cmd run lint`: fail voi 398 errors chu yeu `Extra semicolon` va 9 warnings unused vars.
- `npm.cmd test -- --runInBand`: timeout sau khoang 124s, chua ket luan pass/fail.

