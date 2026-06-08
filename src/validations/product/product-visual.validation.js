import Joi from 'joi'

export const updateVisualProfileSchema = Joi.object({
  dimensions: Joi.object({
    widthCm: Joi.number().min(1).max(2000).optional(),
    heightCm: Joi.number().min(1).max(2000).optional(),
    depthCm: Joi.number().min(0).max(2000).optional(),
  }).optional(),
  visualProfile: Joi.object({
    placementType: Joi.string().valid('wall_mounted', 'floor_standing', 'surface_standing').optional(),
    anchor: Joi.string().valid('center', 'bottom_center', 'bottom_left', 'bottom_right').optional(),
  }).optional(),
})


export const previewCutoutSchema = Joi.object({
  provider: Joi.string().valid('manual', 'remove_bg').default('remove_bg'),
})

export const confirmCutoutSchema = Joi.object({
  tempPublicId: Joi.string().required(),
  view: Joi.string().valid('front', 'left_angle', 'right_angle', 'back').default('front'),
  widthCm: Joi.number().min(1).max(2000).required(),
  heightCm: Joi.number().min(1).max(2000).required(),
  depthCm: Joi.number().min(0).max(2000).optional(),
})
