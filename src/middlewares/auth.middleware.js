import { verifyAccessToken } from '../providers/jwt.provider.js';
import User from '../models/user.model.js';
import AppError from '../utils/app-error.util.js';
import ERRORS from '../constants/error.constant.js';
import HTTP_STATUS from '../constants/http-status.constant.js';

/**
 * Middleware xác thực JWT
 * Trích xuất token từ header: Authorization: Bearer <token>
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Vui lòng đăng nhập để tiếp tục', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Kiểm tra user còn tồn tại và còn active
    const user = await User.findById(decoded.userId).select('_id role isActive');
    if (!user) {
      throw new AppError('Tài khoản không tồn tại', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.UNAUTHORIZED);
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE);
    }

    req.user = user; // Gắn user vào request
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware phân quyền theo role
 * Dùng sau authenticate
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
      );
    }
    next();
  };
};
