import Joi from 'joi';
import { ORDER_STATUS_ENUM } from '../../constants/status.constant.js';

export const createOrderSchema = Joi.object({
  productId: Joi.string().hex().length(24).optional(),
  product: Joi.string().hex().length(24).optional(),
  quantity: Joi.number().integer().min(1).max(100).optional(),
  shippingAddress: Joi.object({
    province: Joi.string().max(100).allow(''),
    district: Joi.string().max(100).allow(''),
    detail: Joi.string().max(300).allow(''),
  }).optional(),
  note: Joi.string().max(1000).allow('').optional(),
}).or('productId', 'product')
  .messages({ 'object.missing': 'Vui lòng cung cấp productId (hoặc product) của sản phẩm' });

export const cancelOrderSchema = Joi.object({
  note: Joi.string().max(500).allow('').optional(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUS_ENUM).required(),
  note: Joi.string().max(500).allow('').optional(),
});
