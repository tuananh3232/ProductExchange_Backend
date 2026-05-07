import HTTP_STATUS from '../constants/http-status.constant.js'
import ERRORS from '../constants/error.constant.js'

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

/**
 * Validates that the given route params are valid MongoDB ObjectIds.
 * Short-circuits with 400 before the request reaches the service/DB layer.
 *
 * Usage: router.get('/:id', validateObjectId('id'), controller)
 *        router.delete('/:id/staff/:staffId', validateObjectId('id', 'staffId'), controller)
 */
export const validateObjectId = (...paramNames) => {
  return (req, res, next) => {
    for (const param of paramNames) {
      const value = req.params[param]
      if (!value || !OBJECT_ID_REGEX.test(value)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: `ID không hợp lệ: ${param}`,
          error: ERRORS.VALIDATION.INVALID_OBJECT_ID,
        })
      }
    }
    next()
  }
}
