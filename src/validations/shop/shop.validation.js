import Joi from 'joi';
import PERMISSIONS from '../../constants/permission.constant.js';

const addressSchema = Joi.object({
  province: Joi.string().max(100).allow(''),
  district: Joi.string().max(100).allow(''),
  detail: Joi.string().max(300).allow(''),
});

export const createShopSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  phone: Joi.string().trim().max(20).allow('').optional(),
  email: Joi.string().trim().email().allow('').optional(),
  address: addressSchema.optional(),
  logo: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().required(),
  }).optional(),
});

export const updateShopSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  slug: Joi.string().trim().min(2).max(120).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  phone: Joi.string().trim().max(20).allow('').optional(),
  email: Joi.string().trim().email().allow('').optional(),
  address: addressSchema.optional(),
  logo: Joi.object({
    url: Joi.string().uri().required(),
    publicId: Joi.string().required(),
  }).optional(),
}).min(1);

export const transferOwnerSchema = Joi.object({
  newOwnerId: Joi.string().hex().length(24).required(),
});

export const addStaffSchema = Joi.object({
  staffUserId: Joi.string().hex().length(24).required(),
});

export const updateStaffPermissionsSchema = Joi.object({
  permissions: Joi.array()
    .items(Joi.string().valid(...Object.values(PERMISSIONS)))
    .default([]),
});
