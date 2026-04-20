import Joi from 'joi';

export const createProductSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200).required(),
  description: Joi.string().trim().min(20).max(3000).required(),
  price: Joi.number().min(0).required(),
  listingType: Joi.string().valid('sell', 'exchange', 'both').required(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor').required(),
  category: Joi.string().hex().length(24).required(), // MongoDB ObjectId
  exchangeFor: Joi.string().max(500).optional().allow(''),
  location: Joi.object({
    province: Joi.string().optional().allow(''),
    district: Joi.string().optional().allow(''),
  }).optional(),
});

export const updateProductSchema = Joi.object({
  title: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().min(20).max(3000),
  price: Joi.number().min(0),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor'),
  category: Joi.string().hex().length(24),
  exchangeFor: Joi.string().max(500).allow(''),
  location: Joi.object({
    province: Joi.string().allow(''),
    district: Joi.string().allow(''),
  }),
}).min(1);

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'hidden', 'sold', 'exchanged').required(),
});
