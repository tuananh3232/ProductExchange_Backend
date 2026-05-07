import rateLimit from 'express-rate-limit'
import HTTP_STATUS from '../constants/http-status.constant.js'
import ERRORS from '../constants/error.constant.js'

const handler = (_req, res) => {
  res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
    success: false,
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
    error: ERRORS.GENERAL.TOO_MANY_REQUESTS,
  })
}

/**
 * Strict limiter for unauthenticated auth endpoints (login, register, password reset).
 * 10 attempts per 15 minutes per IP.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * General API limiter applied globally.
 * 300 requests per 15 minutes per IP; only counts failed requests.
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  handler,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})
