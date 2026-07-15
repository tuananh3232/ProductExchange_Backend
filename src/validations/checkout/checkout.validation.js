import Joi from 'joi'

export const createCheckoutSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    productId: Joi.string().hex().length(24).required(),
    variantId: Joi.string().hex().length(24).optional(),
    quantity: Joi.number().integer().min(1).max(100).required(),
  })).min(1).max(50).required(),
  shippingAddress: Joi.object({
    recipientName: Joi.string().trim().min(2).max(120).required(),
    phone: Joi.string().trim().pattern(/^[0-9+(). -]{8,20}$/).required(),
    province: Joi.string().trim().min(1).max(120).required(),
    district: Joi.string().trim().min(1).max(120).required(),
    detail: Joi.string().trim().min(3).max(500).required(),
  }).required(),
  paymentMethod: Joi.string().valid('payos', 'vnpay', 'wallet').optional(),
})
