# RBAC: Admin và Shop Owner

## Kết luận

- Admin là cấp cao nhất, có thể quản lý toàn bộ role và permission trong hệ thống.
- Shop Owner không quản lý permission toàn hệ thống, mà chỉ quản lý permission của staff trong shop mình sở hữu.
- Staff chỉ được thực hiện các thao tác mà Shop Owner đã tick quyền cho, trong phạm vi shop đó.

## Luồng hiện tại trong hệ thống

### 1. Admin

- Xem danh sách permission.
- Xem danh sách role.
- Cập nhật permission cho role.
- Gán role cho user.
- Seed lại dữ liệu RBAC khi cần.

### 2. Shop Owner

- Tạo shop và trở thành owner của shop.
- Thêm staff vào shop.
- Xem danh sách quyền của staff trong shop.
- Tick hoặc bỏ tick quyền cho từng staff.
- Quyền được lưu theo từng shop, không ảnh hưởng sang shop khác.

### 3. Staff

- Chỉ thao tác được khi có permission phù hợp trong shop đó.
- Nếu bị gỡ khỏi shop thì quyền đi kèm cũng bị xóa.

## Dữ liệu liên quan

- Role và permission được lưu trong database.
- Shop có thêm vùng lưu quyền staff theo shop.
- Product và Order kiểm tra permission theo shop trước khi cho thao tác.

## Ý nghĩa nghiệp vụ

- Admin có toàn quyền hệ thống.
- Shop Owner có quyền điều phối nhân sự nội bộ của shop.
- Staff được phân quyền linh hoạt theo nhu cầu từng shop.

## Ghi chú

- Đây là mô hình hybrid: RBAC toàn hệ thống cho admin và RBAC theo shop cho owner/staff.
- Scope dữ liệu vẫn được kiểm tra song song với permission để tránh truy cập chéo ngoài phạm vi.
