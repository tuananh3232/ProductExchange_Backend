import { env } from '../../configs/env.config.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const getCapabilities = asyncHandler(async (_req, res) => {
  sendSuccess(res, {
    message: 'Lấy cấu hình tính năng thành công',
    data: {
      features: {
        commerce: env.features.commerce,
        withdrawals: env.features.withdrawals,
        exchange: env.features.exchange,
        rental: env.features.rental,
        subscriptionPayment: env.features.subscriptionPayment,
        roomVisualizer: env.features.roomVisualizer,
      },
      paymentProviders: {
        wallet: env.features.walletPayments,
        payos: env.features.payosPayments,
        vnpay: env.features.vnpayPayments,
      },
      currency: 'VND',
    },
  })
})
