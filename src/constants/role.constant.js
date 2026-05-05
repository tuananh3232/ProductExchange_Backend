/**
 * Vai trò (roles) trong hệ thống
 * Sự dụng RBAC
 */

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SELLER: 'seller',
  SHOP_OWNER: 'shop_owner',
  STAFF: 'staff',
};

/**
 * Danh sách các role hợp lệ
 */
export const ROLE_ENUM = Object.values(ROLES);

/**
 * Mô tả vai trò
 */
export const ROLE_DESCRIPTIONS = {
  [ROLES.USER]: 'Người dùng bình thường',
  [ROLES.ADMIN]: 'Quản trị hệ thống',
  [ROLES.SELLER]: 'Người bán hàng',
  [ROLES.SHOP_OWNER]: 'Chủ shop',
  [ROLES.STAFF]: 'Nhân viên shop',
};

/**
 * Quyền hạn từng role
 */
export const ROLE_PERMISSIONS = {
  [ROLES.USER]: ['view_product', 'create_product'],
  [ROLES.SELLER]: ['view_product', 'create_product', 'update_product', 'delete_product'],
  [ROLES.ADMIN]: ['*'], // Admin có tất cả quyền
};

export default ROLES;
