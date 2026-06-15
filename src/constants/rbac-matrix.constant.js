import { PERMISSIONS } from './permission.constant.js'
import { ROLES } from './role.constant.js'

export const RBAC_PROTECTED_ROLE_CODES = [ROLES.ADMIN]

export const RBAC_MATRIX_ROLE_CODES = [ROLES.MEMBER, ROLES.SELLER, ROLES.SHOP_OWNER, ROLES.STAFF]

export const RBAC_ASSIGNABLE_ROLE_CODES = [ROLES.MEMBER, ROLES.SELLER, ROLES.SHOP_OWNER, ROLES.STAFF]

export const RBAC_ROLE_UI = {
  [ROLES.MEMBER]: {
    label: 'Member',
    description: 'Người dùng mua sắm và quản lý tài khoản cá nhân.',
  },
  [ROLES.SELLER]: {
    label: 'Seller',
    description: 'Người bán cá nhân ngoài mô hình shop.',
  },
  [ROLES.SHOP_OWNER]: {
    label: 'Shop',
    description: 'Tài khoản vận hành shop và quản trị nhân sự cửa hàng.',
  },
  [ROLES.STAFF]: {
    label: 'Staff',
    description: 'Nhân sự được cấp quyền xử lý nghiệp vụ trong shop.',
  },
  [ROLES.ADMIN]: {
    label: 'Admin',
    description: 'Vai trò hạt nhân của hệ thống, không chỉnh sửa trong ma trận vận hành.',
  },
}

export const RBAC_MATRIX_GROUPS = [
  {
    key: 'account',
    title: 'Tài khoản & hồ sơ',
    description: 'Các quyền cơ bản để người dùng truy cập và cập nhật thông tin cá nhân.',
  },
  {
    key: 'commerce',
    title: 'Mua sắm & đơn hàng',
    description: 'Các quyền liên quan đến giỏ hàng, đặt hàng và hủy đơn.',
  },
  {
    key: 'personal_seller',
    title: 'Bán cá nhân',
    description: 'Nghiệp vụ dành cho seller hoạt động ngoài mô hình shop.',
  },
  {
    key: 'shop',
    title: 'Quản lý cửa hàng',
    description: 'Các tính năng cần thiết để vận hành shop và đội ngũ staff.',
  },
]

export const RBAC_MATRIX_CAPABILITIES = [
  {
    key: 'account_view_profile',
    groupKey: 'account',
    title: 'Xem hồ sơ cá nhân',
    helper: 'Truy cập trang hồ sơ và thông tin tài khoản cơ bản.',
    permissionKeys: [PERMISSIONS.USER_SELF_READ],
  },
  {
    key: 'account_update_profile',
    groupKey: 'account',
    title: 'Chỉnh sửa thông tin cá nhân',
    helper: 'Cập nhật hồ sơ, số điện thoại và dữ liệu cá nhân.',
    permissionKeys: [PERMISSIONS.USER_SELF_UPDATE],
  },
  {
    key: 'commerce_checkout',
    groupKey: 'commerce',
    title: 'Đặt hàng và thanh toán',
    helper: 'Thêm vào giỏ, cập nhật giỏ và tạo đơn hàng mới.',
    permissionKeys: [
      PERMISSIONS.USER_CART_READ,
      PERMISSIONS.USER_CART_UPDATE,
      PERMISSIONS.USER_CART_CHECKOUT,
      PERMISSIONS.USER_ORDER_CREATE,
    ],
  },
  {
    key: 'commerce_cancel_order',
    groupKey: 'commerce',
    title: 'Hủy đơn hàng đã tạo',
    helper: 'Cho phép người dùng hủy đơn khi vẫn còn ở trạng thái phù hợp.',
    permissionKeys: [PERMISSIONS.USER_ORDER_CANCEL],
  },
  {
    key: 'seller_personal_workspace',
    groupKey: 'personal_seller',
    title: 'Truy cập kênh bán cá nhân',
    helper: 'Mở workspace seller cá nhân, xem sản phẩm và đơn hàng riêng.',
    permissionKeys: [PERMISSIONS.SELLER_PRODUCT_READ, PERMISSIONS.SELLER_ORDER_READ],
  },
  {
    key: 'seller_personal_products',
    groupKey: 'personal_seller',
    title: 'Đăng và cập nhật sản phẩm cá nhân',
    helper: 'Tạo mới, chỉnh sửa, ẩn hiện và xóa sản phẩm seller cá nhân.',
    permissionKeys: [
      PERMISSIONS.SELLER_PRODUCT_CREATE,
      PERMISSIONS.SELLER_PRODUCT_UPDATE,
      PERMISSIONS.SELLER_PRODUCT_DELETE,
      PERMISSIONS.SELLER_PRODUCT_UPDATE_STATUS,
      PERMISSIONS.SELLER_PRODUCT_IMAGE_UPDATE,
    ],
  },
  {
    key: 'seller_personal_orders',
    groupKey: 'personal_seller',
    title: 'Xử lý đơn hàng cá nhân',
    helper: 'Xác nhận, hủy và cập nhật trạng thái đơn seller cá nhân.',
    permissionKeys: [
      PERMISSIONS.SELLER_ORDER_CONFIRM,
      PERMISSIONS.SELLER_ORDER_CANCEL,
      PERMISSIONS.SELLER_ORDER_UPDATE_STATUS,
    ],
  },
  {
    key: 'shop_profile_setup',
    groupKey: 'shop',
    title: 'Thiết lập hồ sơ và gửi duyệt shop',
    helper: 'Chỉnh sửa hồ sơ shop, cập nhật thông tin liên hệ và gửi xét duyệt.',
    permissionKeys: [
      PERMISSIONS.SHOP_PROFILE_READ,
      PERMISSIONS.SHOP_PROFILE_UPDATE,
      PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW,
    ],
  },
  {
    key: 'shop_products',
    groupKey: 'shop',
    title: 'Quản lý sản phẩm của shop',
    helper: 'Xem, tạo, sửa, xóa và cập nhật trạng thái sản phẩm thuộc shop.',
    permissionKeys: [
      PERMISSIONS.SHOP_PRODUCT_READ,
      PERMISSIONS.SHOP_PRODUCT_CREATE,
      PERMISSIONS.SHOP_PRODUCT_UPDATE,
      PERMISSIONS.SHOP_PRODUCT_DELETE,
      PERMISSIONS.SHOP_PRODUCT_UPDATE_STATUS,
      PERMISSIONS.SHOP_PRODUCT_IMAGE_UPDATE,
    ],
  },
  {
    key: 'shop_orders',
    groupKey: 'shop',
    title: 'Xử lý đơn hàng của shop',
    helper: 'Theo dõi đơn, xác nhận và cập nhật tiến độ giao hàng.',
    permissionKeys: [
      PERMISSIONS.SHOP_ORDER_READ,
      PERMISSIONS.SHOP_ORDER_CONFIRM,
      PERMISSIONS.SHOP_ORDER_CANCEL,
      PERMISSIONS.SHOP_ORDER_UPDATE_STATUS,
    ],
  },
  {
    key: 'shop_staff_management',
    groupKey: 'shop',
    title: 'Mời và phân quyền staff',
    helper: 'Xem team, mời staff, gỡ staff và cập nhật permission của staff.',
    permissionKeys: [
      PERMISSIONS.SHOP_STAFF_READ,
      PERMISSIONS.SHOP_STAFF_INVITE,
      PERMISSIONS.SHOP_STAFF_REMOVE,
      PERMISSIONS.SHOP_STAFF_PERMISSION_READ,
      PERMISSIONS.SHOP_STAFF_PERMISSION_UPDATE,
    ],
  },
  {
    key: 'shop_analytics',
    groupKey: 'shop',
    title: 'Xem thống kê vận hành shop',
    helper: 'Doanh thu, hiệu suất đơn hàng, top sản phẩm và phân tích nhân sự.',
    permissionKeys: [PERMISSIONS.SHOP_STATS_READ],
  },
  {
    key: 'shop_wallet',
    groupKey: 'shop',
    title: 'Ví shop và lệnh rút tiền',
    helper: 'Xem số dư, lịch sử giao dịch và tạo yêu cầu rút tiền cho shop.',
    permissionKeys: [
      PERMISSIONS.SHOP_WALLET_READ,
      PERMISSIONS.SHOP_WALLET_TRANSACTION_READ,
      PERMISSIONS.SHOP_WITHDRAWAL_READ,
      PERMISSIONS.SHOP_WITHDRAWAL_CREATE,
    ],
  },
  {
    key: 'shop_messages',
    groupKey: 'shop',
    title: 'Tin nhắn khách hàng',
    helper: 'Đọc, gửi và đánh dấu đã xem trong workspace chat của shop.',
    permissionKeys: [PERMISSIONS.SHOP_CHAT_READ, PERMISSIONS.SHOP_CHAT_SEND, PERMISSIONS.SHOP_CHAT_MARK_READ],
  },
]

export const RBAC_MATRIX_PERMISSION_KEYS = [...new Set(RBAC_MATRIX_CAPABILITIES.flatMap((capability) => capability.permissionKeys))]
