import Joi from 'joi';
import { DELIVERY_STATUS } from '../../constants/status.constant.js';

export const assignDeliverySchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
  deliveryUserId: Joi.string().hex().length(24).required(),
  note: Joi.string().max(500).allow('').optional(),
});

export const deliveryNoteSchema = Joi.object({
  note: Joi.string().max(500).allow('').optional(),
});

export const updateDeliveryStatusSchema = Joi.object({
  status: Joi.string().valid(DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.FAILED).required(),
  note: Joi.string().max(500).allow('').optional(),
});
