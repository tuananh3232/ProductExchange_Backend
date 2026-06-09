/**
 * Định nghĩa các quyền(permissions) trong hệ thống
 * Sự dụng RBAC
 */

export const PERMISSIONS = {
  // Auth
  AUTH_REGISTER: 'auth:register',
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',

  // Product
  PRODUCT_CREATE: 'product:create',
  PRODUCT_READ: 'product:read',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',



  // User
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',

  // Shop
  SHOP_CREATE: 'shop:create',
  SHOP_READ: 'shop:read',
  SHOP_UPDATE: 'shop:update',
  SHOP_VIEW_STATS: 'shop:view_stats',
  SHOP_MANAGE_OWNER: 'shop:manage_owner',
  SHOP_MANAGE_STAFF: 'shop:manage_staff',
  SHOP_MANAGE_STAFF_PERMISSIONS: 'shop:manage_staff_permissions',
  SHOP_CHAT_MANAGE: 'shop:chat_manage',

  // Order
  ORDER_CREATE: 'order:create',
  ORDER_READ: 'order:read',
  ORDER_CONFIRM: 'order:confirm',
  ORDER_CANCEL: 'order:cancel',
  ORDER_UPDATE_STATUS: 'order:update_status',

  // Wallet
  WALLET_VIEW: 'wallet:view',
  WALLET_REQUEST_WITHDRAWAL: 'wallet:request_withdrawal',

  // Admin
  ADMIN_MANAGE_USERS: 'admin:manage_users',
  ADMIN_MANAGE_PRODUCTS: 'admin:manage_products',
  ADMIN_MANAGE_SHOPS: 'admin:manage_shops',
  ADMIN_MANAGE_ROLES: 'admin:manage_roles',
  ADMIN_MANAGE_PERMISSIONS: 'admin:manage_permissions',
  ADMIN_VIEW_STATS: 'admin:view_stats',
  ADMIN_MANAGE_WITHDRAWALS: 'admin:manage_withdrawals',

  // Room Visualizer
  ROOM_VISUALIZER_USE: 'room_visualizer:use',
  PRODUCT_VISUAL_ASSET_MANAGE: 'product_visual_asset:manage',
};

/**
 * Gán quyền cho từng role
 */
export const ROLE_PERMISSION_MAP = {
  member: [
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_LOGOUT,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.SHOP_CREATE,
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CANCEL,
  ],
  seller: [
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_LOGOUT,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CONFIRM,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_UPDATE_STATUS,
  ],
  shop_owner: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.SHOP_CREATE,
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.SHOP_UPDATE,
    PERMISSIONS.SHOP_VIEW_STATS,
    PERMISSIONS.SHOP_MANAGE_OWNER,
    PERMISSIONS.SHOP_MANAGE_STAFF,
    PERMISSIONS.SHOP_MANAGE_STAFF_PERMISSIONS,
    PERMISSIONS.SHOP_CHAT_MANAGE,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CONFIRM,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_UPDATE_STATUS,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_REQUEST_WITHDRAWAL,
    PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE,
  ],
  staff: [
    PERMISSIONS.AUTH_LOGIN,
    PERMISSIONS.AUTH_LOGOUT,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.SHOP_UPDATE,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_READ,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CONFIRM,
    PERMISSIONS.ORDER_UPDATE_STATUS,
  ],
  admin: [
    Object.values(PERMISSIONS), // Admin có tất cả quyền
  ].flat(),
}

/**
 * Metadata cho từng permission — dùng cho capability endpoint và FE hiển thị
 */
export const PERMISSION_METADATA = {
  [PERMISSIONS.AUTH_REGISTER]:  { module: 'auth',           label: 'Đăng ký tài khoản' },
  [PERMISSIONS.AUTH_LOGIN]:     { module: 'auth',           label: 'Đăng nhập' },
  [PERMISSIONS.AUTH_LOGOUT]:    { module: 'auth',           label: 'Đăng xuất' },

  [PERMISSIONS.PRODUCT_CREATE]: { module: 'product',        label: 'Tạo sản phẩm' },
  [PERMISSIONS.PRODUCT_READ]:   { module: 'product',        label: 'Xem sản phẩm' },
  [PERMISSIONS.PRODUCT_UPDATE]: { module: 'product',        label: 'Chỉnh sửa sản phẩm' },
  [PERMISSIONS.PRODUCT_DELETE]: { module: 'product',        label: 'Xóa sản phẩm' },

  [PERMISSIONS.USER_READ]:   { module: 'user', label: 'Xem hồ sơ cá nhân' },
  [PERMISSIONS.USER_UPDATE]: { module: 'user', label: 'Cập nhật hồ sơ' },

  [PERMISSIONS.SHOP_CREATE]:                    { module: 'shop', label: 'Tạo shop' },
  [PERMISSIONS.SHOP_READ]:                      { module: 'shop', label: 'Xem shop' },
  [PERMISSIONS.SHOP_UPDATE]:                    { module: 'shop', label: 'Chỉnh sửa thông tin shop' },
  [PERMISSIONS.SHOP_VIEW_STATS]:                { module: 'shop', label: 'Xem thống kê shop' },
  [PERMISSIONS.SHOP_MANAGE_OWNER]:              { module: 'shop', label: 'Quản lý chủ shop' },
  [PERMISSIONS.SHOP_MANAGE_STAFF]:              { module: 'shop', label: 'Quản lý nhân viên' },
  [PERMISSIONS.SHOP_MANAGE_STAFF_PERMISSIONS]:  { module: 'shop', label: 'Phân quyền nhân viên' },
  [PERMISSIONS.SHOP_CHAT_MANAGE]:               { module: 'shop', label: 'Quản lý chat' },

  [PERMISSIONS.ORDER_CREATE]:        { module: 'order', label: 'Tạo đơn hàng' },
  [PERMISSIONS.ORDER_READ]:          { module: 'order', label: 'Xem đơn hàng' },
  [PERMISSIONS.ORDER_CONFIRM]:       { module: 'order', label: 'Xác nhận đơn hàng' },
  [PERMISSIONS.ORDER_CANCEL]:        { module: 'order', label: 'Hủy đơn hàng' },
  [PERMISSIONS.ORDER_UPDATE_STATUS]: { module: 'order', label: 'Cập nhật trạng thái đơn' },

  [PERMISSIONS.WALLET_VIEW]:               { module: 'wallet', label: 'Xem ví' },
  [PERMISSIONS.WALLET_REQUEST_WITHDRAWAL]: { module: 'wallet', label: 'Yêu cầu rút tiền' },

  [PERMISSIONS.ADMIN_MANAGE_USERS]:       { module: 'admin', label: 'Quản lý người dùng' },
  [PERMISSIONS.ADMIN_MANAGE_PRODUCTS]:    { module: 'admin', label: 'Quản lý sản phẩm & danh mục' },
  [PERMISSIONS.ADMIN_MANAGE_SHOPS]:       { module: 'admin', label: 'Quản lý shop' },
  [PERMISSIONS.ADMIN_MANAGE_ROLES]:       { module: 'admin', label: 'Quản lý vai trò' },
  [PERMISSIONS.ADMIN_MANAGE_PERMISSIONS]: { module: 'admin', label: 'Quản lý quyền hạn' },
  [PERMISSIONS.ADMIN_VIEW_STATS]:         { module: 'admin', label: 'Xem thống kê hệ thống' },
  [PERMISSIONS.ADMIN_MANAGE_WITHDRAWALS]: { module: 'admin', label: 'Quản lý yêu cầu rút tiền' },

  [PERMISSIONS.ROOM_VISUALIZER_USE]:        { module: 'room_visualizer', label: 'Sử dụng Room Visualizer' },
  [PERMISSIONS.PRODUCT_VISUAL_ASSET_MANAGE]: { module: 'room_visualizer', label: 'Quản lý visual asset sản phẩm' },
}

export default PERMISSIONS
