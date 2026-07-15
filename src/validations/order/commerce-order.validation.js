import Joi from 'joi'

export const shipOrderSchema = Joi.object({
    carrier: Joi.string().trim().min(2).max(100).required(),
    trackingCode: Joi.string().trim().min(2).max(100).required(),
    proof: Joi.array().items(Joi.object({
      url: Joi.string().uri().required(),
      publicId: Joi.string().allow('').default(''),
    })).max(10).default([]),
})
