import { env } from '../configs/env.config.js'
import AppError from '../utils/app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'

export const requireFeature = (featureKey) => (req, _res, next) => {
  if (env.features[featureKey]) return next()
  return next(new AppError('Tính năng này hiện chưa được mở', HTTP_STATUS.SERVICE_UNAVAILABLE, 'FEATURE_DISABLED'))
}
