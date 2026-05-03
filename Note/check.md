# CHECK: Project đã phân quyền chưa?

## 1. Câu hỏi cần xác định

* Hệ thống đã có phân quyền (RBAC) chưa?
* Admin có thể tạo, chỉnh sửa, giới hạn quyền cho role khác không?
* Shop Owner có thể phân quyền cho Staff trong shop không?
* Quyền có được lưu trong database hay đang hardcode?

---

# HỆ THỐNG SÀN THƯƠNG MẠI ĐIỆN TỬ (MARKETPLACE)

## Tổng quan

Hệ thống được xây dựng theo mô hình marketplace, hỗ trợ nhiều vai trò (multi-role).

Một user có thể:

* Là Buyer và Seller
* Là Shop Owner và Staff
* Có nhiều role cùng lúc

---

# Các vai trò chính

* Buyer (Người mua)
* Seller (Người bán)
* Shop Owner (Chủ shop)
* Staff (Nhân viên shop)
* Delivery (Nhân viên giao hàng)
* Admin (Quản trị hệ thống)

---

# Phân tích vai trò

## Buyer

* Xem sản phẩm
* Đặt hàng
* Thanh toán
* Theo dõi đơn hàng

## Seller

* Đăng sản phẩm
* Quản lý sản phẩm

## Shop Owner

* Tạo và quản lý shop
* Quản lý sản phẩm
* Quản lý nhân viên (Staff)
* Xử lý đơn hàng

Lưu ý:

* Có thể phân quyền cho Staff
* Có thể giới hạn quyền của Staff

## Staff

* Quản lý sản phẩm (nếu được cấp quyền)
* Xử lý đơn hàng theo permission

## Delivery

* Nhận đơn
* Lấy hàng
* Giao hàng
* Cập nhật trạng thái

## Admin

* Quản lý toàn hệ thống
* Quản lý user và shop
* Phân quyền
* Gán đơn cho delivery

Admin có thể:

* Tạo role
* Gán permission
* Giới hạn quyền của role khác

---

# Quản lý shop

* Một user có thể tạo shop
* Một user có thể quản lý nhiều shop nếu được cấp quyền

Mỗi shop bao gồm:

* 1 Owner
* Nhiều Staff

---

# Phân quyền hệ thống (RBAC)

## Thành phần

### Role

* ADMIN
* BUYER
* SELLER
* STAFF
* DELIVERY

### Permission

Ví dụ:

* CREATE_PRODUCT
* UPDATE_PRODUCT
* DELETE_PRODUCT
* VIEW_ORDER
* ASSIGN_DELIVERY

---

## Nguyên tắc

* Không hardcode quyền trong code
* Quyền được lưu trong database
* Một role có nhiều permission
* Một user có thể có nhiều role

---

## Matrix phân quyền

| Role  | Create | Update | Delete | View |
| ----- | ------ | ------ | ------ | ---- |
| Admin | Yes    | Yes    | Yes    | Yes  |
| Staff | Yes    | Yes    | No     | Yes  |

* Admin có thể cấu hình quyền cho các role
* Shop Owner có thể giới hạn quyền của Staff

---

# Kiểm tra phân quyền

Mỗi API cần kiểm tra 2 lớp:

## 1. Permission

User có quyền thực hiện hành động hay không

## 2. Resource scope

User có quyền trên dữ liệu đó hay không

Ví dụ:

* Seller chỉ thao tác trên shop của mình
* Staff chỉ thao tác trong shop được phân công

---

# Flow nghiệp vụ

## Mua hàng

1. Buyer chọn sản phẩm
2. Tạo đơn hàng
3. Shop xác nhận
4. Hệ thống gán delivery
5. Delivery lấy hàng
6. Delivery giao hàng
7. Hoàn tất đơn hàng

## Bán hàng

1. Người dùng đăng ký shop
2. Tạo sản phẩm
3. Nhận đơn hàng
4. Xử lý đơn

## Giao hàng

1. Nhận đơn
2. Lấy hàng từ shop
3. Giao cho khách
4. Cập nhật trạng thái

---

# Thiết kế RESTful API

## Auth

POST /api/auth/register
POST /api/auth/login

## User

GET /api/users/me
PUT /api/users/me

## Shop

POST /api/shops
GET /api/shops/:id
PUT /api/shops/:id

## Product

GET /api/products
POST /api/products
PUT /api/products/:id
DELETE /api/products/:id

## Order

POST /api/orders
GET /api/orders/:id
GET /api/orders

## Delivery

POST /api/deliveries/assign
PUT /api/deliveries/:id

---

# Chuẩn response API

## Thành công

```json
{
  "success": true,
  "message": "Thực hiện thành công",
  "data": {}
}
```

## Thất bại

```json
{
  "success": false,
  "message": "Bạn không có quyền thực hiện chức năng này"
}
```

---

# Constant (tránh hardcode)

```js
ROLES = ['ADMIN', 'BUYER', 'SELLER', 'STAFF', 'DELIVERY'];

PERMISSIONS = [
  'CREATE_PRODUCT',
  'UPDATE_PRODUCT',
  'DELETE_PRODUCT',
  'VIEW_ORDER',
  'ASSIGN_DELIVERY'
];
```

---

# Kết luận

Hệ thống đạt chuẩn khi:

* Có RBAC (role và permission)
* Admin quản lý toàn bộ quyền
* Shop Owner có thể phân quyền cho Staff
* Không hardcode quyền
* Có kiểm tra permission và scope
* Dễ mở rộng

---

# Checklist

* [ ] Có bảng role
* [ ] Có bảng permission
* [ ] Có bảng mapping role-permission
* [ ] User có thể có nhiều role
* [ ] API có middleware kiểm tra quyền
* [ ] Có kiểm tra phạm vi dữ liệu (scope)
* [ ] Admin chỉnh được quyền
* [ ] Owner chỉnh được quyền Staff
