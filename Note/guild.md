HỆ THỐNG SÀN THƯƠNG MẠI ĐIỆN TỬ (MARKETPLACE)

Tổng quan
Hệ thống được xây dựng theo mô hình sàn thương mại điện tử, cho phép nhiều đối tượng người dùng tham gia vào quá trình mua bán và vận chuyển hàng hóa. Một người dùng có thể đảm nhận nhiều vai trò khác nhau trong hệ thống (multi-role), ví dụ vừa là người mua vừa là người bán.

Các vai trò chính bao gồm:

Buyer (Người mua)
Seller (Người bán)
Shop Owner (Chủ shop)
Staff (Nhân viên shop)
Delivery (Nhân viên giao hàng)
Admin (Quản trị hệ thống)
Phân tích vai trò

Buyer (Người mua):

Xem sản phẩm
Đặt hàng
Thanh toán
Theo dõi đơn hàng

Seller (Người bán):

Đăng bán sản phẩm
Quản lý sản phẩm

Shop Owner (Chủ shop):

Đăng ký thông tin shop
Quản lý shop
Quản lý sản phẩm
Quản lý nhân viên (Staff)
Xử lý đơn hàng

Staff (Nhân viên shop):

Hỗ trợ quản lý sản phẩm
Xử lý đơn hàng theo phân quyền

Delivery (Giao hàng):

Nhận đơn được phân công
Lấy hàng từ người bán
Giao hàng cho người mua
Cập nhật trạng thái giao hàng

Admin (Quản trị):

Quản lý toàn hệ thống
Quản lý user, shop
Phân quyền
Gán đơn cho delivery
Quản lý shop
Một người dùng có thể đăng ký tạo shop
Một người dùng có thể quản lý nhiều shop nếu được cấp quyền
Mỗi shop bao gồm:
1 chủ shop (Owner)
Nhiều nhân viên (Staff)
Phân quyền hệ thống (RBAC)

Hệ thống sử dụng mô hình Role-Based Access Control.

Thành phần gồm:

Role (vai trò): ADMIN, BUYER, SELLER, STAFF, DELIVERY
Permission (quyền): CREATE_PRODUCT, UPDATE_PRODUCT, VIEW_ORDER, ASSIGN_DELIVERY, ...

Nguyên tắc:

Không hardcode quyền trong code
Quyền được lưu trong database
Role được gán nhiều permission
User được gán nhiều role

Phân quyền được quản lý thông qua ma trận (matrix), cho phép tick chọn quyền cho từng role. Khi thay đổi quyền, chỉ cần cập nhật trong database, không cần sửa code.

Kiểm tra phân quyền

Khi xử lý API cần kiểm tra 2 lớp:

Kiểm tra permission: user có quyền thực hiện hành động hay không
Kiểm tra phạm vi dữ liệu:
Seller chỉ thao tác trên shop của mình
Staff chỉ thao tác trong shop được phân công
Flow nghiệp vụ

Flow mua hàng:

Người mua chọn sản phẩm
Tạo đơn hàng
Shop xác nhận đơn
Hệ thống gán delivery
Delivery lấy hàng từ người bán
Delivery giao hàng cho người mua
Hoàn tất đơn hàng

Flow bán hàng:

Người dùng đăng ký shop
Tạo sản phẩm
Nhận đơn hàng
Xử lý đơn

Flow giao hàng:

Nhận đơn
Lấy hàng từ shop
Giao cho khách
Cập nhật trạng thái
Thiết kế RESTful API

Auth:

POST /api/auth/register
POST /api/auth/login

User:

GET /api/users/me
PUT /api/users/me

Shop:

POST /api/shops
GET /api/shops/:id
PUT /api/shops/:id

Product:

GET /api/products
POST /api/products
PUT /api/products/:id
DELETE /api/products/:id

Order:

POST /api/orders
GET /api/orders/:id
GET /api/orders

Delivery:

POST /api/deliveries/assign
PUT /api/deliveries/:id
Chuẩn response API (tiếng Việt)

Thành công:
{
"success": true,
"message": "Thực hiện thành công",
"data": {}
}

Thất bại:
{
"success": false,
"message": "Bạn không có quyền thực hiện chức năng này"
}

Tách constant (tránh hardcode)

Sử dụng constant cho role và permission để dễ quản lý và mở rộng, ví dụ:

ROLES: ADMIN, BUYER, SELLER, STAFF, DELIVERY
PERMISSIONS: CREATE_PRODUCT, VIEW_ORDER, ASSIGN_DELIVERY

Chỉ cập nhật khi thay đổi hệ thống, không viết trực tiếp trong logic xử lý.

Kết luận

Hệ thống đáp ứng đầy đủ chức năng của một sàn thương mại điện tử với:

Kiến trúc RESTful rõ ràng
Phân quyền linh hoạt (multi-role, RBAC)
Không hardcode, dễ mở rộng
Phù hợp triển khai thực tế