import Joi from 'joi'

export const createProjectSchema = Joi.object({
  name: Joi.string().trim().max(120).required(),
  description: Joi.string().max(1000).optional().allow(''),
})

export const updateProjectSchema = Joi.object({
  name: Joi.string().trim().max(120).optional(),
  description: Joi.string().max(1000).optional().allow(''),
})
