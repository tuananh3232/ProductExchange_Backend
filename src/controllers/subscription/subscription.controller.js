import * as subscriptionService from '../../services/subscription/subscription.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

export const checkout = asyncHandler(async (req, res) => {
  const { plan, paymentMethod = 'payos' } = req.body
  const result = await subscriptionService.createSubscriptionCheckout(plan, req.user, paymentMethod)
  sendSuccess(res, { message: 'Tạo thanh toán gói VIP thành công', data: result })
})

export const webhook = asyncHandler(async (req, res) => {
  const result = await subscriptionService.handleSubscriptionWebhook(req.body)
  res.status(200).json({ code: '00', desc: 'success', data: result })
})

export const payosReturn = asyncHandler(async (req, res) => {
  const result = await subscriptionService.handleSubscriptionReturn(req.query, req.user._id)
  sendSuccess(res, { message: 'Đồng bộ kết quả thanh toán thành công', data: result })
})

export const getMySubscription = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getMySubscription(req.user._id)
  sendSuccess(res, { message: 'Lấy thông tin gói VIP thành công', data: result })
})
