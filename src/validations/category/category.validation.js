import Joi from 'joi'

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  slug: Joi.string().trim().optional().allow(''),
  description: Joi.string().trim().max(1000).optional().allow(''),
  icon: Joi.string().trim().optional().allow(''),
  isActive: Joi.boolean().optional(),
})

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  slug: Joi.string().trim(),
  description: Joi.string().trim().max(1000).allow(''),
  icon: Joi.string().trim().allow(''),
  isActive: Joi.boolean(),
}).min(1)
