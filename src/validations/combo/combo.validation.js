import Joi from 'joi'
import { COLOR_TONES, COMBO_CONSTRAINTS, DECOR_ROLES, PRODUCT_STYLES, ROOM_TYPES } from '../../constants/combo.constant.js'

export const generateCombosSchema = Joi.object({
  style: Joi.string().valid(...PRODUCT_STYLES),
  roomType: Joi.string().valid(...ROOM_TYPES),
  colorTone: Joi.string().valid(...COLOR_TONES),
  budget: Joi.number().min(COMBO_CONSTRAINTS.budgetMin).required()
    .messages({ 'number.min': `budget phải >= ${COMBO_CONSTRAINTS.budgetMin.toLocaleString('vi-VN')} (đơn vị VND)` }),
  maxItems: Joi.number()
    .integer()
    .min(COMBO_CONSTRAINTS.maxItemsMin)
    .max(COMBO_CONSTRAINTS.maxItemsMax)
    .default(COMBO_CONSTRAINTS.maxItemsDefault)
    .messages({
      'number.min': `maxItems phải >= ${COMBO_CONSTRAINTS.maxItemsMin}`,
      'number.max': `maxItems phải <= ${COMBO_CONSTRAINTS.maxItemsMax}`,
    }),
  seed: Joi.string().alphanum().max(20),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(10).default(3),
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
