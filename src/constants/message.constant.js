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
  },

  // Product
  PRODUCT: {
    CREATED: 'Đăng sản phẩm thành công',
    FETCHED: 'Lấy danh sách sản phẩm thành công',
    DETAIL_FETCHED: 'Lấy chi tiết sản phẩm thành công',
    UPDATED: 'Cập nhật sản phẩm thành công',
    DELETED: 'Xóa sản phẩm thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái sản phẩm thành công',
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
};

export default MESSAGES;
