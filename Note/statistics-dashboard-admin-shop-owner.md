# Dashboard Thống Kê Cho Admin Và Shop Owner

## Mục tiêu

- Cung cấp màn hình thống kê tổng quan cho admin.
- Cung cấp màn hình thống kê riêng cho từng shop owner.
- Hiển thị các chỉ số quan trọng về doanh thu, sản phẩm, đơn hàng, giao hàng và hoạt động shop.

## 1. Thống kê cho Admin

Admin cần xem toàn hệ thống, gồm:

- Tổng doanh thu.
- Doanh thu theo ngày, tuần, tháng.
- Tổng số đơn hàng.
- Tổng số sản phẩm.
- Tổng số shop.
- Tổng số user.
- Tỉ lệ đơn thành công, đơn hủy, đơn đang xử lý.
- Tỉ lệ giao hàng thành công / thất bại.
- Top shop bán chạy nhất.
- Top sản phẩm bán chạy nhất.
- Top shop có nhiều đơn nhất.
- Top nhân viên giao hàng hoạt động nhiều nhất.
- Biểu đồ tăng trưởng theo thời gian.

## 2. Thống kê cho Shop Owner

Shop owner chỉ xem dữ liệu trong shop của mình, gồm:

- Doanh thu của shop.
- Số đơn hàng của shop.
- Số sản phẩm đang bán.
- Số sản phẩm đã bán / đã trao đổi.
- Số đơn chờ xác nhận.
- Số đơn đang giao.
- Số đơn hoàn tất.
- Tỉ lệ hủy đơn.
- Top sản phẩm bán chạy trong shop.
- Top khách hàng mua nhiều nhất trong shop.
- Hiệu suất staff trong shop.
- Hiệu suất delivery liên quan đến shop.

## 3. Chỉ số nên có

### Doanh thu

- Tổng doanh thu.
- Doanh thu theo ngày.
- Doanh thu theo tháng.
- Doanh thu theo khoảng thời gian tùy chọn.

### Sản phẩm

- Số sản phẩm mới tạo.
- Số sản phẩm đang hiển thị.
- Số sản phẩm đã bán.
- Số sản phẩm đã trao đổi.
- Số sản phẩm bị ẩn.

### Đơn hàng

- Số đơn mới.
- Số đơn đã xác nhận.
- Số đơn đang giao.
- Số đơn hoàn tất.
- Số đơn bị hủy.

### Giao hàng

- Số lượt giao hàng.
- Số lượt giao thành công.
- Số lượt giao thất bại.
- Thời gian giao trung bình.

### Shop

- Số staff của shop.
- Số sản phẩm theo từng staff.
- Số đơn theo từng staff xử lý.
- Tỉ lệ hoạt động theo shop.

## 4. Phân quyền xem thống kê

- Admin xem toàn bộ thống kê hệ thống.
- Shop owner chỉ xem thống kê của shop mình.
- Staff chỉ xem nếu owner cấp quyền.
- Delivery chỉ xem dữ liệu liên quan tới đơn giao của mình nếu cần.

## 5. API đề xuất

### Admin

- `GET /api/v1/admin/stats/overview`
- `GET /api/v1/admin/stats/revenue`
- `GET /api/v1/admin/stats/products`
- `GET /api/v1/admin/stats/orders`
- `GET /api/v1/admin/stats/shops`
- `GET /api/v1/admin/stats/deliveries`
- `GET /api/v1/admin/stats/top-shops`
- `GET /api/v1/admin/stats/top-products`

### Shop Owner

- `GET /api/v1/shops/:id/stats/overview`
- `GET /api/v1/shops/:id/stats/revenue`
- `GET /api/v1/shops/:id/stats/products`
- `GET /api/v1/shops/:id/stats/orders`
- `GET /api/v1/shops/:id/stats/staff`
- `GET /api/v1/shops/:id/stats/deliveries`

## 6. Gợi ý dữ liệu trả về

### Admin overview

- `totalRevenue`
- `totalOrders`
- `totalProducts`
- `totalShops`
- `totalUsers`
- `completedOrders`
- `cancelledOrders`
- `deliverySuccessRate`

### Shop overview

- `shopId`
- `shopName`
- `totalRevenue`
- `totalOrders`
- `activeProducts`
- `soldProducts`
- `exchangedProducts`
- `pendingOrders`
- `completedOrders`

## 7. Nguồn dữ liệu nên lấy

- `orders` để tính doanh thu và trạng thái đơn.
- `products` để thống kê sản phẩm.
- `shops` để thống kê theo shop.
- `deliveries` để thống kê vận chuyển.
- `users` để thống kê người dùng và staff.

## 8. Ghi chú triển khai

- Nên tách riêng service thống kê.
- Nên có query aggregate cho báo cáo lớn.
- Nên hỗ trợ filter theo thời gian.
- Nên cache kết quả thống kê phổ biến để giảm tải.
- Nên chuẩn hóa timezone khi tính doanh thu theo ngày.
