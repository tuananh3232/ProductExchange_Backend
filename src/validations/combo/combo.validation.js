import Joi from 'joi'
import { COLOR_TONES, DECOR_ROLES, PRODUCT_STYLES, ROOM_TYPES } from '../../constants/combo.constant.js'

export const generateCombosSchema = Joi.object({
  style: Joi.string().valid(...PRODUCT_STYLES),
  roomType: Joi.string().valid(...ROOM_TYPES),
  colorTone: Joi.string().valid(...COLOR_TONES),
  budget: Joi.number().positive().required(),
  maxItems: Joi.number().integer().min(2).max(10).default(5),
})

export const alternativesSchema = Joi.object({
  decorRole: Joi.string().valid(...DECOR_ROLES).required(),
  style: Joi.string().valid(...PRODUCT_STYLES),
  roomType: Joi.string().valid(...ROOM_TYPES),
  colorTone: Joi.string().valid(...COLOR_TONES),
  maxPrice: Joi.number().positive(),
  excludeProductIds: Joi.string().allow(''),
  limit: Joi.number().integer().min(1).max(50).default(10),
})
