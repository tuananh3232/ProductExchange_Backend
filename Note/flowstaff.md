Luồng này diễn ra sau khi shop đã được sàn duyệt và ở trạng thái ACTIVE.
Mục tiêu của luồng là cho phép chủ shop thêm nhân viên để cùng vận hành shop như quản lý sản phẩm, xử lý đơn hàng, quản lý kho hoặc chăm sóc khách hàng.

Ban đầu, mọi tài khoản trong hệ thống đều là user thông thường (MEMBER).
Để được tham gia vận hành shop với vai trò staff, user nên hoàn thành xác minh danh tính nhằm đảm bảo tính minh bạch và hạn chế tài khoản giả mạo.

Sau khi shop được kích hoạt, chủ shop có thể vào màn hình Quản lý nhân viên (Staff Management) để gửi lời mời thêm staff vào shop. Chủ shop nhập email hoặc tài khoản của người cần thêm và chọn vai trò hoặc quyền cơ bản cho nhân viên đó.

Hệ thống sẽ tạo một lời mời tham gia shop (shop invitation) với trạng thái PENDING, đồng thời gửi thông báo cho user được mời. User có thể chấp nhận hoặc từ chối lời mời này.

Khi user chấp nhận lời mời, hệ thống sẽ tạo quan hệ thành viên giữa user và shop (shop member). Từ thời điểm này, user chính thức trở thành staff của shop và có thể thao tác trong phạm vi quyền được cấp.

Mỗi staff sẽ có:

Vai trò trong shop (OWNER, STAFF, ...)
Danh sách quyền (permissions)
Trạng thái hoạt động (ACTIVE, INACTIVE, ...)

Hệ thống phân quyền theo từng chức năng cụ thể thay vì chỉ kiểm tra role cứng. Ví dụ:

product.create → tạo sản phẩm
product.update → cập nhật sản phẩm
order.view → xem đơn hàng
order.manage → xử lý đơn hàng
inventory.update → cập nhật tồn kho

Khi staff thực hiện một chức năng, backend sẽ:

Xác thực JWT/token
Kiểm tra user có thuộc shop hay không
Kiểm tra permission tương ứng
Cho phép hoặc từ chối thao tác

Sau khi được cấp quyền, staff có thể tham gia các quy trình vận hành của shop như:

CRUD sản phẩm
Quản lý tồn kho
Xử lý đơn hàng
Cập nhật trạng thái giao hàng
Hỗ trợ khách hàng

Chủ shop cũng có thể:

Thay đổi quyền của staff
Tạm khóa staff
Xóa staff khỏi shop
Chuyển quyền quản lý (nâng cao)

Mô hình này giúp hệ thống hỗ trợ:

Một user tham gia nhiều shop khác nhau
Mỗi shop có nhiều staff
Mỗi staff có quyền riêng biệt