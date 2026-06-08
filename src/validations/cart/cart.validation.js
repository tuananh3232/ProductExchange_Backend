import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const addComboSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: objectId.required(),
        quantity: Joi.number().integer().positive().required(),
      })
    )
    .min(1)
    .required(),
})

export const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
})

export const checkoutCartSchema = Joi.object({
  paymentMethod: Joi.string().trim().uppercase().valid('PAYOS', 'VNPAY', 'WALLET').optional(),
  selectedProductIds: Joi.array().items(objectId).min(1).optional(),
})
