import * as subscriptionService from '../../services/subscription/subscription.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'

export const checkout = asyncHandler(async (req, res) => {
  const result = await subscriptionService.createSubscriptionCheckout(req.body.plan, req.user)
  res.status(200).json({ success: true, ...result })
})

export const webhook = asyncHandler(async (req, res) => {
  const result = await subscriptionService.handleSubscriptionWebhook(req.body)
  res.status(200).json({ code: '00', desc: 'success', data: result })
})

export const payosReturn = asyncHandler(async (req, res) => {
  const result = await subscriptionService.handleSubscriptionReturn(req.query, req.user._id)
  res.status(200).json({ success: true, ...result })
})

export const getMySubscription = asyncHandler(async (req, res) => {
  const result = await subscriptionService.getMySubscription(req.user._id)
  res.status(200).json({ success: true, ...result })
})
