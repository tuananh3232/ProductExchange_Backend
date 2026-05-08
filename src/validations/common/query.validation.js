import Joi from 'joi'

/**
 * Base pagination schema — extend with .keys() for resource-specific filters.
 * Pass { allowUnknown: true } via .options() so domain-specific params are not
 * stripped when this schema is composed into a larger one.
 */
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'page must be a number',
    'number.min': 'page must be at least 1',
    'number.integer': 'page must be an integer',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'limit must be a number',
    'number.min': 'limit must be at least 1',
    'number.max': 'limit must not exceed 100',
  }),
  sortBy: Joi.string().trim().max(50),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).options({ allowUnknown: true })

const objectIdPattern = /^[a-f\d]{24}$/i

export const productQuerySchema = paginationQuerySchema.keys({
  search: Joi.string().trim().max(200),
  category: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'category must be a valid MongoDB ObjectId',
  }),
  shop: Joi.string().pattern(objectIdPattern).messages({
    'string.pattern.base': 'shop must be a valid MongoDB ObjectId',
  }),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor'),
  listingType: Joi.string().valid('sell'),
  status: Joi.string().valid('available', 'hidden', 'pending', 'sold'),
})

export const shopQuerySchema = paginationQuerySchema.keys({
  search: Joi.string().trim().max(200),
  status: Joi.string().valid('draft', 'pending_review', 'active', 'rejected', 'suspended'),
})

export const orderQuerySchema = paginationQuerySchema.keys({
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed'),
  shop: Joi.string().pattern(objectIdPattern),
})
