import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const addComboSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: objectId.required(),
        variantId: objectId.optional(),
        quantity: Joi.number().integer().positive().required(),
      })
    )
    .min(1)
    .required(),
})

export const updateCartItemSchema = Joi.object({
  variantId: objectId.optional(),
  quantity: Joi.number().integer().min(1).required(),
})

export const removeCartItemSchema = Joi.object({
  variantId: objectId.optional(),
})

export const checkoutCartSchema = Joi.object({
  paymentMethod: Joi.string().trim().uppercase().valid('PAYOS', 'VNPAY', 'WALLET').optional(),
  selectedProductIds: Joi.array().items(objectId).min(1).optional(),
  selectedItems: Joi.array().items(Joi.object({
    productId: objectId.required(),
    variantId: objectId.required(),
  })).min(1).optional(),
  shippingAddress: Joi.object({
    recipientName: Joi.string().trim().min(2).max(120).required(),
    phone: Joi.string().trim().pattern(/^[0-9+(). -]{8,20}$/).required(),
    province: Joi.string().trim().min(1).max(120).required(),
    district: Joi.string().trim().min(1).max(120).required(),
    detail: Joi.string().trim().min(3).max(500).required(),
  }).optional(),
})
