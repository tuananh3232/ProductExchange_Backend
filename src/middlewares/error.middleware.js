import { env } from '../configs/env.config.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Lỗi operational (do AppError) — trả về thông báo cụ thể
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,              // Tiếng Việt
      error: err.errorCode || err.message, // Tiếng Anh / mã lỗi
    });
  }

  // Lỗi Mongoose — Duplicate key (email trùng)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `Giá trị ${field} đã tồn tại trong hệ thống`,
      error: `Duplicate key: ${field}`,
    });
  }

  // Lỗi Mongoose — Cast error (ObjectId không hợp lệ)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID không hợp lệ',
      error: 'Invalid ID format',
    });
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ, vui lòng đăng nhập lại',
      error: 'Token is invalid',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập đã hết hạn',
      error: 'Token has expired',
    });
  }

  // Log lỗi không xác định (môi trường development)
  if (env.nodeEnv === 'development') {
    console.error('💥 Unhandled Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ nội bộ',
      error: err.message,
      stack: err.stack,
    });
  }

  // Production — không lộ stack trace
  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi, vui lòng thử lại sau',
    error: 'Internal server error',
  });
};
