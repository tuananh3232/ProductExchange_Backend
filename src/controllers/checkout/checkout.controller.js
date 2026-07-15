import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import * as checkoutService from '../../services/checkout/checkout.service.js'
import { createPaymentAttempt } from '../../services/payment/payment-attempt.service.js'

export const createCheckout = asyncHandler(async (req, res) => {
  const checkout = await checkoutService.createCheckout({
    buyerId: req.user._id,
    idempotencyKey: req.get('idempotency-key'),
    items: req.body.items,
    shippingAddress: req.body.shippingAddress,
  })
  const payment = req.body.paymentMethod
    ? await createPaymentAttempt({
      checkoutId: checkout._id,
      buyerId: req.user._id,
      provider: req.body.paymentMethod,
      idempotencyKey: `${req.get('idempotency-key')}:payment`,
      clientIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    })
    : null
  sendSuccess(res, {
    message: 'Tạo checkout thành công',
    data: {
      checkout,
      payment,
      reservationExpiresAt: checkout.expiresAt,
      paymentUrl: payment?.checkoutUrl || null,
    },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getCheckout = asyncHandler(async (req, res) => {
  const checkout = await checkoutService.getCheckout(req.params.checkoutId, req.user._id)
  sendSuccess(res, { message: 'Lấy checkout thành công', data: { checkout } })
})
