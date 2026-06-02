import Joi from 'joi'

export const addComboSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().hex().length(24).required(),
        quantity: Joi.number().integer().positive().required(),
      })
    )
    .min(1)
    .required(),
})
