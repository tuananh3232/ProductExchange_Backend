import Joi from 'joi';

export const createExchangeSchema = Joi.object({
  requestedProduct: Joi.string().hex().length(24).required(),
  offeredProduct: Joi.string().hex().length(24).required(),
  message: Joi.string().max(500).optional().allow(''),
});

export const respondExchangeSchema = Joi.object({
  action: Joi.string().valid('accept', 'reject').required(),
  rejectionReason: Joi.when('action', {
    is: 'reject',
    then: Joi.string().max(300).optional().allow(''),
  }),
});
