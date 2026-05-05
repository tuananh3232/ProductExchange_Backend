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
}).min(1).messages({
  'object.min': 'Vui lòng cung cấp ít nhất một thông tin cần cập nhật',
});

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
})

export const rejectShopSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min': 'Lý do từ chối phải có ít nhất 5 ký tự',
    'any.required': 'Lý do từ chối là bắt buộc',
  }),
})

export const suspendShopSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min': 'Lý do đình chỉ phải có ít nhất 5 ký tự',
    'any.required': 'Lý do đình chỉ là bắt buộc',
  }),
});
