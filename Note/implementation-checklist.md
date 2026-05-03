# Marketplace Implementation Checklist

## 1. Nền tảng hệ thống
- [x] Chuẩn hóa kiến trúc RESTful cho toàn bộ API.
- [x] Tách rõ layer `routes`, `controllers`, `services`, `repositories`, `models`.
- [x] Chuẩn hóa format response tiếng Việt cho success/error.
- [x] Tách toàn bộ constant cho role, permission, status, message.
- [x] Bổ sung bộ test cơ bản cho auth, product, exchange.

## 2. Auth và tài khoản
- [x] Đăng ký tài khoản.
- [x] Đăng nhập bằng email/password.
- [x] JWT access token.
- [x] JWT refresh token.
- [x] Đăng xuất.
- [x] Lấy thông tin người dùng hiện tại.
- [x] Cập nhật hồ sơ người dùng.
- [x] Đổi mật khẩu.
- [x] Quên mật khẩu / đặt lại mật khẩu.
- [x] Xác minh email.
- [x] Khóa / mở khóa tài khoản theo admin.

## 3. Phân quyền
- [x] Thiết kế RBAC theo database.
- [x] Tạo collection/bảng `roles`.np
- [x] Tạo collection/bảng `permissions`.
- [x] Tạo quan hệ role-permission.
- [x] Gán nhiều role cho một user.
- [x] Kiểm tra permission trước khi xử lý API.
- [x] Kiểm tra phạm vi dữ liệu theo owner/shop/staff/delivery.

## 4. Shop
- [x] Thiết kế model `shop`.
- [x] Tạo API đăng ký shop.
- [x] Tạo API cập nhật shop.
- [x] Tạo API xem chi tiết shop.
- [x] Tạo API danh sách shop.
- [x] Quản lý owner của shop.
- [x] Quản lý staff trong shop.
- [x] Kiểm tra quyền truy cập theo shop.

## 5. Product
- [x] Tạo sản phẩm.
- [x] Cập nhật sản phẩm.
- [x] Xóa sản phẩm.
- [x] Danh sách sản phẩm.
- [x] Xem chi tiết sản phẩm.
- [x] Tìm kiếm, lọc, phân trang.
- [x] Upload và quản lý ảnh sản phẩm.
- [x] Gắn sản phẩm vào shop.
- [x] Phân quyền theo owner/shop/staff.
- [x] Trạng thái sản phẩm theo vòng đời kinh doanh.

## 6. Order
- [x] Thiết kế model `order`.
- [x] Tạo đơn hàng.
- [x] Xem chi tiết đơn hàng.
- [x] Danh sách đơn hàng theo user/shop.
- [x] Shop xác nhận đơn.
- [x] Hủy đơn hàng.
- [x] Cập nhật trạng thái đơn hàng.
- [x] Lưu lịch sử trạng thái đơn.

## 7. Delivery
- [x] Thiết kế model `delivery` hoặc `shipment`.
- [x] Gán đơn cho nhân viên giao hàng.
- [x] Nhân viên giao hàng nhận đơn.
- [x] Cập nhật trạng thái lấy hàng.
- [x] Cập nhật trạng thái giao hàng.
- [x] Hoàn tất đơn giao.

## 8. Exchange / Trade
- [x] Tạo đề xuất trao đổi sản phẩm.
- [x] Danh sách đề xuất trao đổi.
- [x] Xem chi tiết đề xuất trao đổi.
- [x] Chấp nhận / từ chối đề xuất.
- [x] Hủy đề xuất.
- [x] Hoàn tất trao đổi.
- [x] Ràng buộc chặt trạng thái sản phẩm khi trao đổi.
- [x] Lưu lịch sử trao đổi đầy đủ hơn.

## 9. Chuẩn API và tài liệu
- [x] Đồng bộ swagger cho toàn bộ route.
- [x] Đảm bảo mọi route đều có mô tả request/response.
- [x] Chuẩn hóa mã lỗi và message tiếng Việt.

## 10. Dữ liệu và hạ tầng
- [ ] Thiết kế index cho các truy vấn chính.
- [ ] Tối ưu query cho danh sách product và exchange.
- [ ] Bổ sung seed data cho role, permission, category.
- [ ] Cấu hình storage cho ảnh sản phẩm.

## 11. Kiểm thử
- [ ] Test auth.
- [ ] Test product.
- [ ] Test exchange.
- [ ] Test phân quyền.
- [ ] Test validation và error handling.
- [ ] Test API theo luồng nghiệp vụ chính.

## 12. Mức ưu tiên đề xuất
- [ ] Ưu tiên 1: Auth, role, permission, product core.
- [ ] Ưu tiên 2: Shop và order.
- [ ] Ưu tiên 3: Delivery và tracking.
- [ ] Ưu tiên 4: Nâng cấp exchange, analytics, notification.