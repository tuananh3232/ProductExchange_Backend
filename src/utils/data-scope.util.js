import AppError from './app-error.util.js';
import HTTP_STATUS from '../constants/http-status.constant.js';
import ERRORS from '../constants/error.constant.js';
import { ROLES } from '../constants/role.constant.js';
import { ROLE_PERMISSION_MAP } from '../constants/permission.constant.js';
import Shop from '../models/shop.model.js';

const toArray = (value) => (Array.isArray(value) ? value : []);

const includesId = (arr, id) => {
  const target = id ? id.toString() : null;
  if (!target) return false;
  return arr.some((item) => item && item.toString() === target);
};

export const hasRole = (user, role) => toArray(user && user.roles).includes(role);

export const isAdmin = (user) => hasRole(user, ROLES.ADMIN);

export const canAccessByOwner = (user, ownerId) => {
  if (!ownerId) return false;
  return user && user._id && user._id.toString() === ownerId.toString();
};

export const canAccessByShop = (user, shopId) => {
  if (!shopId) return false;
  const userShopIds = toArray(user && user.shopIds);
  return includesId(userShopIds, shopId);
};

export const canAccessShopPermission = async (user, shopId, permissionKey) => {
  if (!shopId || !permissionKey) return false;
  if (isAdmin(user)) return true;

  const userId = user && user._id ? user._id.toString() : null;
  if (!userId) return false;

  const shop = await Shop.findById(shopId).select('_id owner staff staffPermissions isActive');
  if (!shop || !shop.isActive) return false;

  const ownerId = shop.owner && shop.owner._id ? shop.owner._id.toString() : shop.owner ? shop.owner.toString() : null;
  if (ownerId === userId) return true;

  // If staffPermissions explicitly define permissions for staff, honor them
  const explicit = (shop.staffPermissions || []).some((entry) => {
    const staffId = entry.staffUser && entry.staffUser._id ? entry.staffUser._id.toString() : entry.staffUser ? entry.staffUser.toString() : null;
    return staffId === userId && Array.isArray(entry.permissions) && entry.permissions.includes(permissionKey);
  });
  if (explicit) return true;

  // Fallback: if user is listed in shop.staff and their role grants the permissionKey, allow it
  const staffIds = (shop.staff || []).map((s) => (s && s._id ? s._id.toString() : s ? s.toString() : null));
  if (staffIds.includes(userId)) {
    const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
    for (const r of roles) {
      const perms = ROLE_PERMISSION_MAP[r] || [];
      if (perms.includes(permissionKey)) return true;
    }
  }

  return false;
};

export const assertShopPermission = async ({
  user,
  shopId,
  permissionKey,
  message = 'Bạn không có quyền thao tác trên shop này',
  errorCode = ERRORS.AUTH.FORBIDDEN,
}) => {
  const allowed = await canAccessShopPermission(user, shopId, permissionKey);
  if (!allowed) {
    throw new AppError(message, HTTP_STATUS.FORBIDDEN, errorCode);
  }
};

export const assertDataScope = ({
  user,
  ownerId,
  shopId,
  message = 'Bạn không có quyền truy cập dữ liệu này',
  errorCode = ERRORS.AUTH.FORBIDDEN,
}) => {
  if (isAdmin(user)) return;

  const passOwner = canAccessByOwner(user, ownerId);
  const passShop = canAccessByShop(user, shopId);

  if (passOwner || passShop) {
    return;
  }

  throw new AppError(message, HTTP_STATUS.FORBIDDEN, errorCode);
};
