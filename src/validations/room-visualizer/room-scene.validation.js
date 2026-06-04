import Joi from 'joi'

export const createSceneSchema = Joi.object({
  name: Joi.string().trim().max(120).required(),
})

export const updateSceneSchema = Joi.object({
  name: Joi.string().trim().max(120).optional(),
})

export const calibrationSchema = Joi.object({
  start: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
  }).required(),
  end: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
  }).required(),
  realLengthCm: Joi.number().min(1).required(),
})

const objectIdPattern = /^[a-f\d]{24}$/i

export const placementsSchema = Joi.object({
  placements: Joi.array()
    .min(1)
    .items(
      Joi.object({
        product: Joi.string().pattern(objectIdPattern).required(),
        cutoutPublicId: Joi.string().required(),
        view: Joi.string().valid('front', 'left_angle', 'right_angle', 'back').default('front'),
        x: Joi.number().required(),
        y: Joi.number().required(),
        scale: Joi.number().default(1),
        rotation: Joi.number().default(0),
        zIndex: Joi.number().integer().default(1),
        opacity: Joi.number().min(0).max(1).default(1),
        locked: Joi.boolean().default(false),
      })
    )
    .required(),
})
