import Joi from 'joi'

export const createPaymentAttemptSchema = Joi.object({
    checkoutId: Joi.string().hex().length(24).required(),
    provider: Joi.string().valid('payos', 'vnpay', 'wallet').required(),
})
