import { ROLES } from '../constants/role.constant.js'

const ROLE_PRIORITY = [ROLES.ADMIN, ROLES.SHOP_OWNER, ROLES.STAFF, ROLES.SELLER, ROLES.MEMBER]

const getPrimaryRole = (roles = []) => ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || ROLES.MEMBER

/**
 * Format user object for API responses while keeping legacy fields.
 */
export const toUserResponse = (user = {}) => {
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [ROLES.MEMBER]
  const id = user._id?.toString?.() || user.id?.toString?.() || user.id
  const avatarUrl = user.avatarUrl || user.avatar?.url || ''
  const isActive = user.isActive !== false

  return {
    id,
    email: user.email || '',
    name: user.name || user.fullName || '',
    fullName: user.fullName || user.name || '',
    avatarUrl,
    avatar: user.avatar || { url: avatarUrl, publicId: '' },
    phone: user.phone || '',
    address: user.address || { province: '', district: '', detail: '' },
    roles,
    primaryRole: getPrimaryRole(roles),
    status: isActive ? 'active' : 'inactive',
    isActive,
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  }
}
