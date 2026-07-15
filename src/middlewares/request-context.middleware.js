import crypto from 'crypto'
import logger from '../utils/logger.util.js'

export const requestContext = (req, res, next) => {
  const requestId = req.get('x-request-id') || crypto.randomUUID()
  const startedAt = Date.now()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)

  res.on('finish', () => {
    logger.info('http_request_completed', {
      requestId,
      method: req.method,
      path: req.originalUrl?.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?._id?.toString?.() || null,
    })
  })

  next()
}
