import Joi from 'joi'

const objectId = Joi.string().hex().length(24)

export const createReviewSchema = Joi.object({
  orderId: objectId.required(),
  productId: objectId.required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(2000).optional().allow(''),
})

export const updateReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().trim().max(2000).allow(''),
}).min(1)

export const replyReviewSchema = Joi.object({
  content: Joi.string().trim().min(1).max(1000).required(),
})

export const productReviewQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string().optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  hasImage: Joi.boolean().optional(),
}).unknown(true)
