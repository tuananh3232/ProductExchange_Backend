# Phân quyền hiện trạng và hướng xử lý (theo ma trận)

## Mục tiêu tài liệu

Tài liệu này cập nhật hướng xử lý phân quyền dựa trên:

- Backend hiện tại: `E:\Code_Ky8\EXE201\ProductExchange_Backend`
- Frontend hiện tại: `E:\Code_Ky7\EXE101\Project\anh-decor`

Mục tiêu:

- Chốt cách hiểu đúng về phân quyền của dự án.
- Xác định BE có cần tổng hợp lại permission để FE render theo ma trận hay không.
- Đề xuất UI/UX dạng ma trận để dễ dùng và dễ quản trị.
- Giảm scope hợp lý để dự án hiện tại vẫn vận hành được.

---

## 1. Kết luận nhanh

### 1.1. Có thể refactor UI/UX theo dạng ma trận

Có, và đây là hướng phù hợp với giao diện hiện tại.

Lý do:

- Ma trận giúp nhìn nhanh role nào có quyền gì.
- Phù hợp cho admin quản lý role hệ thống.
- Phù hợp cho owner cấp quyền riêng cho staff theo shop.
- Giảm việc hiển thị danh sách checkbox dài trên UI.

### 1.2. Không nên bỏ tính năng phân quyền staff theo shop

Không nên loại bỏ.

Backend hiện tại đã có nền tảng tốt cho:

- `roles[]` trên user
- system permission theo role trong DB
- `shop.staffPermissions` theo từng shop

Tính năng nên giữ, nhưng cần làm gọn và tách rõ scope.

### 1.3. BE nên tổng hợp lại permission để FE render dễ hơn

Có.

Không nhất thiết đổi toàn bộ cơ chế authorization, nhưng BE nên trả thêm metadata để FE có thể render ma trận dễ hơn:

- group/module của permission
- label dễ hiểu theo nghiệp vụ
- mô tả ngắn
- mức độ nhạy cảm
- có nên hiện trong ma trận hay bỏ qua

Tóm gọn:

- BE không cần bỏ logic RBAC hiện tại.
- nhưng nên chuẩn hóa và tổng hợp dữ liệu permission.

---

## 2. Cách hiểu về phân quyền trong dự án

Dự án hiện tại có 3 lớp:

### 2.1. Role trên user

Role hiện có:

- `member`
- `seller`
- `shop_owner`
- `staff`
- `admin`

Đây là lớp nhận dạng cơ bản, không nên dùng làm nguồn sự thật duy nhất cho UI.

### 2.2. System permissions

Là quyền cấp hệ thống, backend kiểm tra bằng `requirePermissions(...)`.

Dùng cho:

- quản lý users
- quản lý products (system scope)
- quản lý shops
- quản lý withdrawals
- xem analytics hệ thống
- quản lý RBAC hệ thống

### 2.3. Shop permissions

Là quyền theo từng shop, backend kiểm tra bằng `requireShopPermission(...)`.

Dùng cho:

- thao tác sản phẩm trong shop
- xử lý đơn hàng trong shop
- xem thống kê shop
- chat shop
- quản lý team/staff shop

---

## 3. Nguyên tắc nghiệp vụ cần chốt

### 3.1. Tách rõ system permissions và shop permissions

Không trộn hai nhóm này trong cùng một ma trận; cần có hai bài toán riêng:

1. `System Role Matrix` (cho admin)
2. `Shop Staff Permission Matrix` (cho owner/shop)

### 3.2. Admin không được tự sửa role của chính mình

Quy tắc này nên chốt rõ để:

- tránh tự khóa chính mình khỏi quyền đang có
- tránh trường hợp nâng/cắt quyền dẫn đến mất kiểm soát

Đề xuất:

- Admin có thể sửa role của user khác.
- Admin không được edit role assignment cho chính account của mình.
- Nếu cần, chỉ cho `super_admin` (nếu có) thực hiện, nhưng hiện tại dự án chưa có role này.

### 3.3. Không đưa các permission phổ thông vào ma trận

Các quyền gần như tính năng mặc định (không giúp phân biệt vai trò quản trị) nên bỏ qua:

- `auth:login`, `auth:logout`
- đổi mật khẩu, xem/cập nhật profile
- các thao tác session cơ bản

Ma trận nên hiển các quyền tạo khác biệt vận hành.

### 3.4. Shop staff không được động vào quyền hệ thống

Shop staff không nên có các quyền:

- KYC hệ thống
- quản lý user hệ thống
- quản lý withdrawals hệ thống
- quản lý RBAC hệ thống
- quản lý category hệ thống

Shop staff chỉ hoạt động trong phạm vi shop.

---

## 4. Vấn đề hiện tại của dự án

### 4.1. FE đang gate bằng role nhiều hơn permission

Hệ quả:

- vào được màn nhưng query trả 403
- menu, button hiển thị sai
- khó để UI hoạt động theo quyền thực tế

### 4.2. Contract permission chưa đẹp cho UI ma trận

Backend đang trả:

- `key`, `description`, `module`

Frontend muốn thêm để render đẹp:

- `label`, `group`, `description`, `sensitivity`, `visibleInMatrix`

### 4.3. Session FE chưa sync tốt sau khi đổi role/quyền

Nếu admin đổi role user, API đã cập nhật nhưng FE vẫn hiển menu cũ; cần snapshot capability để FE đồng bộ.

### 4.4. Category đang hở quyền ở backend

Route category chỉ yêu cầu `authenticate` mà chưa check permission hệ thống — cần fix sớm.

---

## 5. Đề xuất UI/UX theo dạng ma trận

### 5.1. Tách hai ma trận

- Matrix A — System Role Matrix: cột là role hệ thống, hàng là capability hệ thống.
- Matrix B — Shop Staff Matrix: cột là staff/preset trong shop, hàng là nhóm quyền shop.

#### Matrix A — System Role Matrix (gợi ý cột)

Cột đề xuất: `Admin`, `Operations`, `Reviewer`, `Viewer`.

Ghi chú:

- Đây là đề xuất UI logic, không bắt buộc map 1-1 với role code trong DB.

#### Matrix B — Shop Staff Matrix

Cột có thể là từng staff member hoặc preset role trong shop.
Hàng là các nhóm quyền shop (Sản phẩm, Đơn hàng, Thống kê, Chat, Nhân sự).

Phù hợp cho dialog cấp quyền và overview nhanh.

### 5.2. Trạng thái ô trong ma trận

Mỗi ô nên có một trong 3 trạng thái:

- `Granted`
- `Restricted / Owner only`
- `Denied`

Không cần quá nhiều trạng thái phức tạp. Có thể thêm phụ: `Hidden from self-edit` cho rule admin không tự sửa chính mình.

### 5.3. Hàng trong ma trận là capability, không phải permission thô

Nên có 2 tầng:

- Tầng 1 — Capability business (ví dụ: `Manage Users`, `Review KYC`, `Manage Withdrawals`, `View Platform Analytics`).
- Tầng 2 — Mapping sang permission thực tế (ví dụ: `Manage Users` -> `admin:manage_users`).

FE hiển capability; BE vẫn authorize bằng permission thực tế.

### 5.4. Nhóm quyền shop (gợi ý)

Sản phẩm:

- Xem sản phẩm
- Tạo sản phẩm
- Sửa sản phẩm
- Xóa sản phẩm

Đơn hàng:

- Xem đơn
- Xác nhận đơn
- Cập nhật trạng thái
- Hủy đơn từ phía shop

Thống kê:

- Xem thống kê shop

Chat:

- Quản lý chat khách hàng

Nhân sự:

- Mời staff
- Gỡ staff
- Sửa quyền staff

Ghi chú: ở phase hiện tại, nên để `Nhân sự` là owner-only.

---

## 6. Đề xuất payload permission để BE cập nhật và FE render

BE nên bổ sung metadata cho permission. Ví dụ response:

```json
{
  "_id": "permission-id",
  "key": "admin:manage_users",
  "label": "Quản lý người dùng",
  "description": "Xem, khóa, mở khóa và kiểm tra người dùng trên nền tảng",
  "module": "admin",
  "group": "users",
  "scope": "system",
  "sensitivity": "high",
  "visibleInMatrix": true
}
```

### 6.1. Các field FE cần nhất

- `key`: field kỹ thuật để submit
- `label`: hiển thị trên UI
- `description`: mô tả ngắn dưới label
- `group`: dùng để nhóm thành section trong ma trận
- `scope`: `system` hoặc `shop`
- `visibleInMatrix`: bỏ qua các permission không cần hiện

### 6.2. Các permission nên bỏ qua khỏi ma trận

Đề xuất `visibleInMatrix = false` cho:

- `auth:login`, `auth:logout`
- `user:read`, `user:update`
- các quyền profile/session cơ bản

Lý do: không giúp người quản trị ra quyết định, làm ma trận dài.

### 6.3. Các permission system nên đưa vào ma trận

- `admin:manage_users`
- `admin:manage_products`
- `admin:manage_shops`
- `admin:manage_roles`
- `admin:manage_permissions`
- `admin:view_stats`
- `admin:manage_withdrawals`
- (nếu fix category) `admin:manage_categories`

### 6.4. Các permission shop nên đưa vào ma trận staff

- `product:create`, `product:read`, `product:update`, `product:delete`
- `order:read`, `order:confirm`, `order:update_status`, `order:cancel`
- `shop:view_stats`, `shop:chat_manage`, `shop:manage_staff`, `shop:manage_staff_permissions`

---

## 7. Có cần đổi role model ở backend không?

### 7.1. Không cần đổi lớn ngay

Backend hiện tại vẫn dùng được nếu giữ:

- role DB
- permission DB
- shop staff permission theo shop

Không cần rework toàn bộ authorization ngay.

### 7.2. Những gì BE nên bổ sung để dùng ma trận đẹp

1. Permission metadata
2. Capability grouping
3. Rule ngăn self-edit role
4. Session endpoint trả capability snapshot

### 7.3. Có nên tạo role mới như Manager/Editor/Viewer không

Không bắt buộc ở phase đầu.

Hai hướng:

- Hướng A — Giữ role code hiện tại, FE chỉ dùng display label đẹp hơn (ít phá backend, nhanh triển khai).
- Hướng B — Tạo thêm role rõ nghĩa hơn (`manager`, `reviewer`, `viewer`) — đẹp hơn cho ma trận nhưng cần cập nhật enum, seed data và logic.

Kết luận: hiện tại theo Hướng A; cân nhắc Hướng B sau nếu cần.

---

## 8. Quy tắc nghiệp vụ đề xuất cho admin/editor

### 8.1. Admin không được sửa role của chính mình

Áp dụng cho:

- assign roles
- update role permission nếu role đó là role chính của admin đang đăng nhập

Ít nhất cần khóa nút edit role assignment cho current user.

### 8.2. Admin có thể sửa role khác

Admin có thể:

- assign role cho user khác
- sửa permission của role khác
- seed RBAC

Nhưng phải có guard tránh thao tác lên chính mình.

### 8.3. Không hiển role không liên quan trong UI

Nếu ma trận system permissions thì không nhất thiết hiển các role như `member`, `seller`, `shop_owner` trừ khi cần.

---

## 9. Gợi ý ma trận system permissions (ví dụ)

| Capability                     | Admin   | Operations | Reviewer | Viewer  |
| ------------------------------ | ------- | ---------- | -------- | ------- |
| Manage Users                   | granted | optional   | denied   | denied  |
| Review KYC                     | granted | granted    | granted  | denied  |
| Review Shops                   | granted | granted    | granted  | denied  |
| Manage Withdrawals             | granted | granted    | denied   | denied  |
| View Platform Analytics        | granted | granted    | optional | granted |
| Manage Products (system scope) | granted | granted    | optional | denied  |
| Manage Categories              | granted | granted    | denied   | denied  |
| Edit System RBAC               | granted | denied     | denied   | denied  |

Ghi chú:

- Đây là ma trận business để team chốt UX, chưa bắt buộc backend có role code y chang.

---

## 10. Gợi ý ma trận shop staff và preset

### 10.1. Preset đề xuất

Product Editor:
- `product:create`, `product:read`, `product:update`

Order Operator:
- `product:read`, `order:read`, `order:confirm`, `order:update_status`

Analyst:
- `product:read`, `order:read`, `shop:view_stats`

Custom: owner tick tay từng ô.

### 10.2. Mặc định staff mới

Khuyến nghị mặc định: `Product Editor`.

Không cấp mặc định: `shop:view_stats`, `shop:manage_staff`, `shop:manage_staff_permissions`, wallet/withdrawal (nếu có sau này).

---

## 11. Backend cần cập nhật gì để FE triển khai ma trận

### 11.1. Bắt buộc

1. Fix category permission
2. Chuẩn hóa payload permission/role
3. Thêm metadata `scope`, `group`, `label`, `visibleInMatrix`
4. Session endpoint trả `roles` và `systemPermissions` (capability snapshot)
5. Rule chặn admin tự sửa role của chính mình

### 11.2. Nên có

1. Endpoint trả capability config cho FE
2. Trả về role có mô tả và display label
3. Trả về grouped permissions cho dialog mời staff

Đề xuất:

- `GET /admin/rbac/permissions`
- `GET /admin/rbac/roles`

### 11.3. Không nên làm trong phase này

- đổi toàn bộ role enum sang manager/editor/viewer
- làm permission inheritance phức tạp
- thêm super-admin nếu chưa cần

---

## 12. Frontend cần cập nhật gì để dùng ma trận tốt

### 12.1. Tách hai màn rõ ràng

Màn 1 — System RBAC:
- xem role matrix
- edit role permissions
- assign role cho user khác

Màn 2 — Shop Staff Permissions:
- mời staff
- chọn preset
- custom permission cho từng staff
- xem matrix nhỏ theo từng staff

### 12.2. Đổi model render

Không render trực tiếp danh sách permission phẳng. Cần:

- `capability sections`
- `matrix columns`
- `cell state`

Ví dụ type:

```ts
type MatrixCellState = 'granted' | 'denied' | 'restricted'
```

### 12.3. Đổi cách gate route và menu

Chuyển dần sang capability-based:
- system menu theo `systemPermissions`
- shop menu theo `staffPermissions` của active shop

Ví dụ: không có `shop:view_stats` thì ẩn `Analytics`.

### 12.4. Bổ sung unauthorized state

Cần component chung cho `403`, `401`, `500` — không dùng empty state cho trường hợp thiếu quyền.

---

## 13. Thứ tự triển khai đề xuất

### Phase 1 — Chuẩn hóa BE cho ma trận

1. Fix category permission
2. Chuẩn hóa payload permission/role
3. Đánh dấu permission nào bỏ qua trong ma trận
4. Thêm rule admin không tự sửa role của mình
5. Thêm session/capability snapshot

### Phase 2 — Refactor FE dùng capability

1. Sửa types và mappers permission
2. Refactor RBAC page thành matrix system
3. Refactor team permissions thành matrix/preset
4. Sửa menu và route theo capability
5. Thêm unauthorized states

### Phase 3 — Tối ưu UI/UX

1. Thêm preset nhanh
2. Thêm capability preview
3. Thêm note/cảnh báo quyền nhạy cảm
4. Thêm audit-friendly labels

---

## 14. Kết luận

Hướng phù hợp nhất với dự án hiện tại là:

- Giữ backend authorization hiện có.
- Không bỏ tính năng staff permission theo shop.
- Refactor UI/UX sang dạng ma trận.
- Yêu cầu backend chuẩn hóa và tổng hợp metadata cho permission.
- Các tính năng phổ thông như login/logout, đổi mật khẩu, profile không đưa vào ma trận.
- Admin không được tự sửa role của chính mình.

Tóm lại:

- System permissions và shop permissions phải tách rõ.
- Matrix system dùng cho admin role management.
- Matrix shop dùng cho owner cấp quyền staff.
- BE chỉ cần chuẩn hóa dữ liệu và rule, không cần làm lại RBAC toàn bộ.
- FE sau khi có permission metadata sẽ dễ triển khai hơn rất nhiều.
