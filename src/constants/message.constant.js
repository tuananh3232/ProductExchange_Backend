const MESSAGES = {
  // Auth
  AUTH: {
    REGISTER_SUCCESS: 'Đăng ký tài khoản thành công',
    LOGIN_SUCCESS: 'Đăng nhập thành công',
    LOGOUT_SUCCESS: 'Đăng xuất thành công',
    REFRESH_TOKEN_SUCCESS: 'Làm mới token thành công',
    PROFILE_FETCHED: 'Lấy thông tin cá nhân thành công',
    PROFILE_UPDATED: 'Cập nhật thông tin thành công',
    PASSWORD_CHANGED: 'Đổi mật khẩu thành công',
    GOOGLE_LOGIN_SUCCESS: 'Đăng nhập Google thành công',
    FORGOT_PASSWORD_SENT: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu',
    PASSWORD_RESET_SUCCESS: 'Đặt lại mật khẩu thành công',
    VERIFICATION_EMAIL_SENT: 'Nếu email tồn tại, hệ thống đã gửi email xác minh',
    EMAIL_VERIFIED: 'Xác minh email thành công',
    EMAIL_ALREADY_VERIFIED: 'Email đã được xác minh trước đó',
  },

  // Product
  PRODUCT: {
    CREATED: 'Đăng sản phẩm thành công',
    FETCHED: 'Lấy danh sách sản phẩm thành công',
    DETAIL_FETCHED: 'Lấy chi tiết sản phẩm thành công',
    UPDATED: 'Cập nhật sản phẩm thành công',
    DELETED: 'Xóa sản phẩm thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái sản phẩm thành công',
    IMAGES_ADDED: 'Thêm ảnh sản phẩm thành công',
    IMAGE_REMOVED: 'Xóa ảnh sản phẩm thành công',
  },

  // Exchange
  EXCHANGE: {
    CREATED: 'Gửi đề xuất trao đổi thành công',
    FETCHED: 'Lấy danh sách đề xuất thành công',
    DETAIL_FETCHED: 'Lấy chi tiết đề xuất thành công',
    ACCEPTED: 'Chấp nhận đề xuất trao đổi thành công',
    REJECTED: 'Từ chối đề xuất trao đổi',
    CANCELLED: 'Hủy đề xuất trao đổi thành công',
    COMPLETED: 'Xác nhận hoàn tất trao đổi thành công',
  },

  // User
  USER: {
    FETCHED: 'Lấy danh sách người dùng thành công',
    DETAIL_FETCHED: 'Lấy thông tin người dùng thành công',
    UPDATED: 'Cập nhật người dùng thành công',
    DELETED: 'Xóa người dùng thành công',
    BANNED: 'Khóa tài khoản thành công',
    UNBANNED: 'Mở khóa tài khoản thành công',
  },

  SHOP: {
    CREATED: 'Đăng ký shop thành công',
    FETCHED: 'Lấy danh sách shop thành công',
    DETAIL_FETCHED: 'Lấy chi tiết shop thành công',
    UPDATED: 'Cập nhật shop thành công',
    OWNER_UPDATED: 'Cập nhật owner của shop thành công',
    STAFF_ADDED: 'Thêm staff vào shop thành công',
    STAFF_REMOVED: 'Gỡ staff khỏi shop thành công',
    STAFF_PERMISSIONS_FETCHED: 'Lấy danh sách quyền staff thành công',
    STAFF_PERMISSIONS_UPDATED: 'Cập nhật quyền staff thành công',
  },

  ORDER: {
    CREATED: 'Tạo đơn hàng thành công',
    FETCHED: 'Lấy danh sách đơn hàng thành công',
    DETAIL_FETCHED: 'Lấy chi tiết đơn hàng thành công',
    CONFIRMED: 'Shop xác nhận đơn hàng thành công',
    CANCELLED: 'Hủy đơn hàng thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái đơn hàng thành công',
  },

  DELIVERY: {
    ASSIGNED: 'Gán đơn cho nhân viên giao hàng thành công',
    FETCHED: 'Lấy danh sách đơn giao hàng thành công',
    DETAIL_FETCHED: 'Lấy chi tiết đơn giao hàng thành công',
    ACCEPTED: 'Nhân viên giao hàng đã nhận đơn',
    PICKED_UP: 'Cập nhật trạng thái lấy hàng thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái giao hàng thành công',
    COMPLETED: 'Hoàn tất đơn giao thành công',
  },

  STATS: {
    ADMIN_OVERVIEW_FETCHED: 'Lấy thống kê tổng quan hệ thống thành công',
    ADMIN_REVENUE_FETCHED: 'Lấy thống kê doanh thu hệ thống thành công',
    ADMIN_TOP_SHOPS_FETCHED: 'Lấy thống kê shop nổi bật thành công',
    ADMIN_TOP_PRODUCTS_FETCHED: 'Lấy thống kê sản phẩm nổi bật thành công',
    SHOP_OVERVIEW_FETCHED: 'Lấy thống kê shop thành công',
    SHOP_REVENUE_FETCHED: 'Lấy thống kê doanh thu shop thành công',
    SHOP_PRODUCTS_FETCHED: 'Lấy thống kê sản phẩm shop thành công',
    SHOP_ORDERS_FETCHED: 'Lấy thống kê đơn hàng shop thành công',
    SHOP_STAFF_FETCHED: 'Lấy thống kê nhân sự shop thành công',
    SHOP_DELIVERIES_FETCHED: 'Lấy thống kê giao hàng shop thành công',
  },

  PAYMENT: {
    CREATED: 'Tạo yêu cầu thanh toán thành công',
    CALLBACK_PROCESSED: 'Xử lý kết quả thanh toán thành công',
  },

  RBAC: {
    PERMISSIONS_FETCHED: 'Lấy danh sách quyền thành công',
    ROLES_FETCHED: 'Lấy danh sách vai trò thành công',
    ROLE_UPDATED: 'Cập nhật quyền cho vai trò thành công',
    USER_ROLES_UPDATED: 'Cập nhật vai trò người dùng thành công',
    SEED_SUCCESS: 'Khởi tạo dữ liệu RBAC thành công',
  },
};

export default MESSAGES;
