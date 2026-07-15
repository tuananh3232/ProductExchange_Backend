/**
 * Roles used by the RBAC system.
 */

export const ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
  SELLER: 'seller',
  SHOP_OWNER: 'shop_owner',
  STAFF: 'staff',
  PRIVACY_ADMIN: 'privacy_admin',
}

export const ROLE_ENUM = Object.values(ROLES)

export const ROLE_DESCRIPTIONS = {
  [ROLES.MEMBER]: 'Member',
  [ROLES.ADMIN]: 'System admin',
  [ROLES.SELLER]: 'Personal seller',
  [ROLES.SHOP_OWNER]: 'Shop Owner',
  [ROLES.STAFF]: 'Shop staff',
  [ROLES.PRIVACY_ADMIN]: 'Sensitive data reviewer',
}

export const ROLE_PERMISSIONS = {
  [ROLES.MEMBER]: ['view_product'],
  [ROLES.SELLER]: ['view_product', 'create_product', 'update_product', 'delete_product'],
  [ROLES.ADMIN]: ['*'],
}

export default ROLES
