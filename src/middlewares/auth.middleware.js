import { verifyAccessToken } from '../providers/jwt.provider.js'
import User from '../models/user.model.js'
import AppError from '../utils/app-error.util.js'
import ERRORS from '../constants/error.constant.js'
import HTTP_STATUS from '../constants/http-status.constant.js'
import * as roleRepo from '../repositories/role/role.repository.js'
import { canAccessShopPermission } from '../utils/data-scope.util.js'
import { reconcileOwnerShopQuota } from '../services/shop/shop.service.js'

/**
 * Middleware xác thực JWT
 * Trích xuất token từ header: Authorization: Bearer <token>
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Vui lòng đăng nhập để tiếp tục', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.UNAUTHORIZED)
    }

    const token = authHeader.split(' ')[1]
    const decoded = verifyAccessToken(token)

    // Kiểm tra user còn tồn tại và còn active.
    const user = await User.findById(decoded.userId).select('_id roles isActive vip')
    if (!user) {
      throw new AppError('Tài khoản không tồn tại', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.UNAUTHORIZED)
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE)
    }

    await reconcileOwnerShopQuota(user._id, { userDoc: user })

    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : []

    req.user = {
      _id: user._id,
      roles: userRoles,
      isActive: user.isActive,
      vip: user.vip,
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware phân quyền theo role
 * Dùng sau authenticate
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.roles || []
    const isAllowed = roles.some((role) => userRoles.includes(role))

    if (!isAllowed) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
      )
    }
    next()
  }
}

/**
 * Middleware phân quyền theo permission (RBAC database-driven)
 */
export const requirePermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!requiredPermissions.length) {
        return next()
      }

      const userRoles = req.user?.roles || []
      if (!userRoles.length) {
        throw new AppError('Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
      }

      const roles = await roleRepo.findByCodesWithPermissions(userRoles)
      const grantedPermissions = new Set()

      for (const role of roles) {
        for (const permission of role.permissions || []) {
          grantedPermissions.add(permission.key)
        }
      }

      const hasAllPermissions = requiredPermissions.every((permission) => grantedPermissions.has(permission))
      if (!hasAllPermissions) {
        throw new AppError('Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
      }

      req.user.permissions = [...grantedPermissions]
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware phân quyền theo permission trong phạm vi 1 shop cụ thể.
 * Owner của shop luôn được phép đi tiếp, staff cần có permission tương ứng.
 */
export const requireShopPermission = (permissionKey, shopIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const shopId = req.params?.[shopIdParam]

      if (!shopId) {
        throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
      }

      const allowed = await canAccessShopPermission(req.user, shopId, permissionKey)
      if (!allowed) {
        throw new AppError('Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export const requireVip = async (req, res, next) => {
  try {
    const { roles = [], vip, permissions: cachedPermissions } = req.user || {}
    const isAdmin = roles.includes('admin')
    const hasVip = Boolean(vip?.expiresAt && new Date(vip.expiresAt) > new Date())

    if (isAdmin || hasVip) return next()

    let permissions = cachedPermissions || []
    if (!permissions.length && roles.length) {
      const dbRoles = await roleRepo.findByCodesWithPermissions(roles)
      const granted = new Set()
      for (const role of dbRoles) {
        for (const perm of role.permissions || []) granted.add(perm.key)
      }
      permissions = [...granted]
      req.user.permissions = permissions
    }

    if (permissions.includes('room_visualizer:use')) return next()

    throw new AppError('Tính năng này chỉ dành cho tài khoản VIP', HTTP_STATUS.FORBIDDEN, 'VIP_REQUIRED')
  } catch (error) {
    next(error)
  }
}

export const requireShopOwnerProductVisual = (req, res, next) => {
  try {
    const { roles = [], permissions = [] } = req.user || {}
    const isAdmin = roles.includes('admin')
    const isShopOwnerWithPermission =
      roles.includes('shop_owner') && permissions.includes('product_visual_asset:manage')

    if (!isAdmin && !isShopOwnerWithPermission) {
      throw new AppError(
        'Chỉ chủ shop mới được quản lý visual asset sản phẩm',
        HTTP_STATUS.FORBIDDEN,
        'SHOP_OWNER_REQUIRED'
      )
    }

    next()
  } catch (error) {
    next(error)
  }
}
