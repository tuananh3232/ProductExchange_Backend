Rà soát project ProductExchange_Backend hiện tại và thu thập toàn bộ thông tin cần thiết để làm lại seed data đồng bộ.

Mục tiêu:
- Không sửa code business logic.
- Không tạo seed mới ngay.
- Chỉ thu thập cấu trúc model, enum, relationship, dữ liệu mẫu hiện tại và đề xuất seed data chuẩn.
- Sau khi thu thập xong, xuất ra báo cáo rõ ràng để làm seed lại từ đầu.

Yêu cầu rà soát:

1. Kiểm tra toàn bộ thư mục model/schema
Tìm và đọc các file:
- src/models/**/*.js
- src/modules/**/model*.js nếu có
- src/**/**/*.model.js

Với mỗi model, ghi lại:
- Tên collection/model
- Field bắt buộc
- Field optional
- Kiểu dữ liệu
- Default value
- Enum/status hợp lệ
- Ref sang model nào
- Unique/index
- Soft delete field nếu có, ví dụ isActive, deletedAt
- timestamps có bật không

2. Kiểm tra constants liên quan
Đọc các file:
- src/constants/*.js
- src/constants/**/*.js
- file enum/status/message/error nếu có

Ghi lại các enum quan trọng:
- role user
- product status
- order status
- payment status
- shop status
- KYC status
- notification type/status
- ownerType
- transaction type/status
- subscription status nếu có

3. Kiểm tra service để hiểu logic data hợp lệ
Đọc các service quan trọng:
- auth.service.js
- user.service.js
- shop.service.js
- product.service.js
- cart.service.js
- combo.service.js
- order.service.js
- payment.service.js
- wallet.service.js hoặc user-wallet.service.js
- notification.service.js
- review/feedback service nếu có

Ghi lại:
- Khi tạo user cần field gì
- Khi tạo shop cần field gì
- Khi tạo product cần field gì
- Product hợp lệ để add cart/order cần điều kiện gì
- Order hợp lệ cần product/shop/user/payment như thế nào
- Wallet tạo lúc nào
- Payment cần order như thế nào
- Notification gắn với user/order/shop/product ra sao

4. Kiểm tra route/API để biết flow seed nên phục vụ
Đọc:
- src/routes/index.js
- src/routes/**/*.js

Ghi lại các flow chính cần seed hỗ trợ test:
- auth/login
- admin
- seller/shop owner
- customer/member
- shop
- product
- combo
- cart
- order
- payment
- wallet
- notification
- review/feedback nếu có

5. Kiểm tra seed cũ nếu có
Tìm các file:
- seed.js
- seeder.js
- scripts/seed*.js
- src/seed*.js
- src/scripts/*.js
- database/seed*.js
- tests/fixtures/*.js
- tests/helpers/*.js

Ghi lại:
- Seed hiện có đang tạo collection nào
- Dữ liệu nào đang lỗi/thừa/thiếu
- Role nào chưa đúng
- Status nào không khớp enum hiện tại
- Product nào không đủ điều kiện add cart/order
- User nào thiếu wallet/profile/shop
- Order/payment nào thiếu liên kết

6. Kiểm tra test để biết seed cần phục vụ case nào
Đọc:
- tests/**/*.test.js
- tests/**/*.spec.js

Ghi lại:
- Test đang cần user role gì
- Test đang cần product status gì
- Test đang cần shop status gì
- Test đang cần cart/combo/order/payment data gì
- Các lỗi test do seed/data không đồng bộ nếu có

7. Nếu có thể chạy lệnh kiểm tra MongoDB hiện tại
Không xóa data.
Không update data.
Chỉ đọc data.

Đề xuất chạy các lệnh đọc sau nếu có quyền:

npm test -- --runInBand

npm run lint

node --check src/server.js

Nếu project có script seed/list data thì kiểm tra package.json trước:
cat package.json

Nếu có MongoDB local/dev, dùng script Node.js tạm để thống kê collection:
- số lượng documents mỗi collection
- 5 sample documents mỗi collection
- các field xuất hiện trong từng collection
- các giá trị enum/status đang có thực tế
- các ObjectId ref bị thiếu hoặc orphan

8. Tạo báo cáo cuối cùng gồm các phần:

A. Tổng quan data hiện tại
- Các collection hiện có
- Collection nào quan trọng
- Collection nào đang thiếu seed

B. Model map
Ví dụ:
User
- required:
- optional:
- enum:
- ref:
- index:
- note:

Product
- required:
- optional:
- enum:
- ref:
- điều kiện hợp lệ để hiển thị/add cart/order:

C. Relationship map
Ví dụ:
User 1-n Shop
Shop 1-n Product
User 1-1 Cart
Cart n-1 Product
User 1-n Order
Order 1-1 Payment
User 1-1 Wallet

D. Seed data cần có
Đề xuất bộ seed chuẩn gồm:
- Admin user
- Customer users
- Seller users
- Shop owner users
- Staff users nếu có
- Shops với nhiều status: pending, approved, rejected
- Products với nhiều status: available, pending, sold/unavailable nếu enum có
- Products đủ stock để test cart
- Products hết stock để test lỗi
- Cart mẫu
- Combo mẫu nếu có
- Orders mẫu
- Payments mẫu
- Wallets mẫu
- Notifications mẫu
- Reviews/feedback mẫu nếu có

E. Các điểm không đồng bộ/rủi ro hiện tại
Ví dụ:
- role trong seed không khớp enum
- product status cũ không còn hợp lệ
- order ref product đã bị xóa
- user thiếu wallet
- shop thiếu owner
- cart item ref product không tồn tại
- payment ref order không tồn tại
- product stock/status không phù hợp với cart/order

F. Đề xuất seed mới
Không code seed vội.
Chỉ mô tả cấu trúc seed mới nên viết:
- thứ tự tạo data
- dependency giữa các collection
- data nào cần ObjectId cố định
- password mặc định cho account test
- cách clear database an toàn trong môi trường test/dev
- cách tránh chạy seed vào production

Quan trọng:
- Không sửa code.
- Không xóa database.
- Không ghi dữ liệu.
- Không tạo seed file mới ở bước này.
- Chỉ thu thập, phân tích và báo cáo.