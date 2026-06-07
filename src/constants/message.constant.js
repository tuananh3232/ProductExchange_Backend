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
    VERIFICATION_EMAIL_SENT: 'Nếu email tồn tại, hệ thống đã gửi mã OTP xác minh',
    EMAIL_VERIFIED: 'Xác minh email thành công',
    EMAIL_ALREADY_VERIFIED: 'Email đã được xác minh trước đó',
  },

  USER: {
    BANNED: 'Khóa tài khoản người dùng thành công',
    UNBANNED: 'Mở khóa tài khoản người dùng thành công',
  },

  ADMIN: {
    USERS_FETCHED: 'Lấy danh sách người dùng thành công',
  },

  // Product
  PRODUCT: {
    CREATED: 'Đăng sản phẩm thành công',
    FETCHED: 'Lấy danh sách sản phẩm thành công',
    ADMIN_FETCHED: 'Lấy danh sách sản phẩm (admin) thành công',
    SHOP_FETCHED: 'Lấy danh sách sản phẩm của shop thành công',
    SELLER_FETCHED: 'Lấy danh sách sản phẩm cá nhân thành công',
    DETAIL_FETCHED: 'Lấy chi tiết sản phẩm thành công',
    UPDATED: 'Cập nhật sản phẩm thành công',
    DELETED: 'Xóa sản phẩm thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái sản phẩm thành công',
    IMAGES_ADDED: 'Thêm ảnh sản phẩm thành công',
    IMAGE_REMOVED: 'Xóa ảnh sản phẩm thành công',
  },

  COMBO: {
    GENERATED: 'Tạo combo sản phẩm thành công',
    NO_PRODUCTS: 'Không tìm thấy sản phẩm phù hợp với tiêu chí đã chọn',
    ALTERNATIVES_FETCHED: 'Tìm sản phẩm thay thế thành công',
    NO_ALTERNATIVES: 'Không tìm thấy sản phẩm thay thế',
  },

  CART: {
    COMBO_ADDED: 'Thêm combo vào giỏ hàng thành công',
    FETCHED: 'Lấy giỏ hàng thành công',
    ITEM_ADDED: 'Thêm sản phẩm vào giỏ hàng thành công',
    UPDATED: 'Cập nhật giỏ hàng thành công',
    ITEM_REMOVED: 'Xóa sản phẩm khỏi giỏ hàng thành công',
    CLEARED: 'Xóa giỏ hàng thành công',
    EMPTY: 'Giỏ hàng trống',
    SOME_PRODUCTS_UNAVAILABLE: 'Một hoặc nhiều sản phẩm không còn khả dụng',
  },

  SHOP: {
    CREATED: 'Đăng ký shop thành công',
    FETCHED: 'Lấy danh sách shop thành công',
    DETAIL_FETCHED: 'Lấy chi tiết shop thành công',
    UPDATED: 'Cập nhật shop thành công',
    DELETED_REJECTED: 'Xóa shop bị từ chối thành công',
    OWNER_UPDATED: 'Cập nhật owner của shop thành công',
    STAFF_ADDED: 'Thêm staff vào shop thành công',
    STAFF_FETCHED: 'Lấy danh sách staff thành công',
    STAFF_REMOVED: 'Gỡ staff khỏi shop thành công',
    STAFF_PERMISSIONS_FETCHED: 'Lấy danh sách quyền staff thành công',
    STAFF_PERMISSIONS_UPDATED: 'Cập nhật quyền staff thành công',
    SUBMITTED_FOR_REVIEW: 'Nộp shop để xét duyệt thành công',
    MY_SHOPS_FETCHED: 'Lấy danh sách shop của tôi thành công',
    ADMIN_SHOPS_FETCHED: 'Lấy danh sách shop (admin) thành công',
    ADMIN_SHOP_DETAIL_FETCHED: 'Lấy chi tiết shop (admin) thành công',
    APPROVED: 'Duyệt shop thành công',
    REJECTED: 'Từ chối shop thành công',
    SUSPENDED: 'Đình chỉ shop thành công',
    RESUBMITTED: 'Nộp lại shop để xét duyệt thành công',
    UNSUSPENDED: 'Gỡ đình chỉ shop thành công',
    INVITATION_SENT: 'Đã gửi lời mời nhân sự qua email',
    INVITATION_ACCEPTED: 'Chấp nhận lời mời tham gia shop thành công',
    INVITATION_REJECTED: 'Từ chối lời mời tham gia shop thành công',
    INVITATION_CANCELLED: 'Hủy lời mời tham gia shop thành công',
    INVITATIONS_FETCHED: 'Lấy danh sách lời mời thành công',
    MY_INVITATIONS_FETCHED: 'Lấy danh sách lời mời của tôi thành công',
    INVITEE_CANDIDATES_FETCHED: 'Lấy danh sách người có thể mời thành công',
    USER_BY_EMAIL_FETCHED: 'Tìm người dùng theo email thành công',
    DASHBOARD_FETCHED: 'Lấy thông tin shop thành công',
  },

  ORDER: {
    CREATED: 'Tạo đơn hàng thành công',
    FETCHED: 'Lấy danh sách đơn hàng thành công',
    DETAIL_FETCHED: 'Lấy chi tiết đơn hàng thành công',
    CONFIRMED: 'Shop xác nhận đơn hàng thành công',
    CANCELLED: 'Hủy đơn hàng thành công',
    STATUS_UPDATED: 'Cập nhật trạng thái đơn hàng thành công',
  },

  CONVERSATION: {
    CREATED: 'Tạo cuộc trò chuyện thành công',
    SHOP_CREATED: 'Tạo cuộc trò chuyện với shop thành công',
    FETCHED: 'Lấy danh sách cuộc trò chuyện thành công',
    MESSAGES_FETCHED: 'Lấy danh sách tin nhắn thành công',
    MESSAGE_SENT: 'Gửi tin nhắn thành công',
    MARKED_AS_READ: 'Đánh dấu đã đọc thành công',
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
  },

  PAYMENT: {
    CREATED: 'Tạo yêu cầu thanh toán thành công',
    CALLBACK_PROCESSED: 'Xử lý kết quả thanh toán thành công',
    WEBHOOK_PROCESSED: 'Xử lý webhook thanh toán thành công',
  },

  USER_WALLET: {
    FETCHED: 'Lấy thông tin ví cá nhân thành công',
    TRANSACTIONS_FETCHED: 'Lấy lịch sử giao dịch ví thành công',
    TOPUP_CREATED: 'Tạo yêu cầu nạp tiền thành công',
    TOPUP_CALLBACK_PROCESSED: 'Xử lý kết quả nạp tiền thành công',
    ORDER_PAID: 'Thanh toán đơn hàng bằng ví thành công',
    TOPUPS_FETCHED: 'Lấy lịch sử nạp tiền thành công',
    ACTIVITY_FETCHED: 'Lấy lịch sử hoạt động ví thành công',
    WITHDRAWAL_REQUESTED: 'Tạo yêu cầu rút tiền thành công',
    WITHDRAWALS_FETCHED: 'Lấy danh sách yêu cầu rút tiền thành công',
    WITHDRAWAL_APPROVED: 'Duyệt yêu cầu rút tiền thành công',
    WITHDRAWAL_REJECTED: 'Từ chối yêu cầu rút tiền thành công',
    WITHDRAWAL_COMPLETED: 'Xác nhận chuyển tiền thành công',
  },

  RBAC: {
    PERMISSIONS_FETCHED: 'Lấy danh sách quyền thành công',
    ROLES_FETCHED: 'Lấy danh sách vai trò thành công',
    ROLE_UPDATED: 'Cập nhật quyền cho vai trò thành công',
    USER_ROLES_UPDATED: 'Cập nhật vai trò người dùng thành công',
    SEED_SUCCESS: 'Khởi tạo dữ liệu RBAC thành công',
  },
  KYC: {
    SUBMITTED: 'Nộp hồ sơ xác minh danh tính thành công',
    FETCHED: 'Lấy thông tin KYC thành công',
    FETCHED_ALL: 'Lấy danh sách KYC thành công',
    APPROVED: 'Xác minh danh tính thành công',
    REJECTED: 'Từ chối hồ sơ xác minh danh tính thành công',
  },

  CATEGORY: {
    CREATED: 'Tạo danh mục thành công',
    FETCHED: 'Lấy danh sách danh mục thành công',
    DETAIL_FETCHED: 'Lấy chi tiết danh mục thành công',
    UPDATED: 'Cập nhật danh mục thành công',
    DELETED: 'Xóa danh mục thành công',
  },
}

export default MESSAGES
