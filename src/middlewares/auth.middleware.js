import { verifyAccessToken } from '../providers/jwt.provider.js'
import User from '../models/user.model.js'
import AppError from '../utils/app-error.util.js'
import ERRORS from '../constants/error.constant.js'
import HTTP_STATUS from '../constants/http-status.constant.js'
import * as roleRepo from '../repositories/role/role.repository.js'

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

    // Kiểm tra user còn tồn tại và còn active
    const user = await User.findById(decoded.userId).select('_id role roles isActive')
    if (!user) {
      throw new AppError('Tài khoản không tồn tại', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.UNAUTHORIZED)
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE)
    }

    const userRoles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role].filter(Boolean)

    const primaryRole = userRoles.includes(user.role) ? user.role : userRoles[0]

    req.user = {
      _id: user._id,
      role: primaryRole,
      roles: userRoles,
      isActive: user.isActive,
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
