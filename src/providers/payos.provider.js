import { PayOS } from '@payos/node'
import { env } from '../configs/env.config.js'
import AppError from '../utils/app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'

const client = () => {
  const { clientId, apiKey, checksumKey } = env.payment.payos
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError('PayOS chưa được cấu hình', HTTP_STATUS.SERVICE_UNAVAILABLE, 'PAYOS_NOT_CONFIGURED')
  }
  return new PayOS({ clientId, apiKey, checksumKey })
}

export const payosProvider = {
  create: (payload) => client().paymentRequests.create(payload),
  query: (orderCode) => client().paymentRequests.get(orderCode),
  cancelBeforePaid: (orderCode, reason) => client().paymentRequests.cancel(orderCode, reason),
  verifyWebhook: (payload) => client().webhooks.verify(payload),
  refundCapability: 'manual',
}
