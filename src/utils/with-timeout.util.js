import AppError from './app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'

/**
 * Đua một promise (thường là lời gọi dịch vụ bên thứ 3) với một bộ đếm thời gian.
 * Nếu quá hạn, ném AppError 504 thay vì để request treo vô thời hạn.
 * @param {Promise<any>} promise - tác vụ cần giới hạn thời gian
 * @param {number} ms - thời gian chờ tối đa (ms)
 * @param {{ message?: string, errorCode?: string }} [opts]
 */
export const withTimeout = (promise, ms, opts = {}) => {
  const {
    message = 'Dịch vụ bên ngoài phản hồi quá lâu, vui lòng thử lại.',
    errorCode = 'UPSTREAM_TIMEOUT',
  } = opts

  let timer
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new AppError(message, HTTP_STATUS.GATEWAY_TIMEOUT, errorCode)), ms)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
