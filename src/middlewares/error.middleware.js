import { env } from '../configs/env.config.js'
import logger from '../utils/logger.util.js'

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error('http_request_failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || err.code || err.name,
    message: err.message,
  })
  // Lỗi operational (do AppError) — trả về thông báo cụ thể
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,              // Tiếng Việt
      error: err.errorCode || err.message, // Tiếng Anh / mã lỗi
      requestId: req.requestId,
    })
  }

  // Lỗi Mongoose — Duplicate key (email trùng)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0]
    return res.status(409).json({
      success: false,
      message: `Giá trị ${field} đã tồn tại trong hệ thống`,
      error: `Duplicate key: ${field}`,
      requestId: req.requestId,
    })
  }

  // Lỗi Mongoose — Cast error (ObjectId không hợp lệ)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID không hợp lệ',
      error: 'Invalid ID format',
      requestId: req.requestId,
    })
  }

  // Lỗi JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ, vui lòng đăng nhập lại',
      error: 'Token is invalid',
      requestId: req.requestId,
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập đã hết hạn',
      error: 'Token has expired',
      requestId: req.requestId,
    })
  }

  // Log lỗi không xác định (môi trường development)
  if (env.nodeEnv === 'development') {
    console.error('💥 Unhandled Error:', err)
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi máy chủ nội bộ',
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
    })
  }

  // Production — không lộ stack trace
  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi, vui lòng thử lại sau',
    error: 'Internal server error',
    requestId: req.requestId,
  })
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy API được yêu cầu',
    error: 'ROUTE_NOT_FOUND',
    requestId: req.requestId,
  })
}
