import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Tên phải có ít nhất 2 ký tự',
    'string.max': 'Tên không được vượt quá 100 ký tự',
    'any.required': 'Tên là bắt buộc',
  }),
  email: Joi.string().email().lowercase().required().messages({
    'string.email': 'Định dạng email không hợp lệ',
    'any.required': 'Email là bắt buộc',
  }),
  password: Joi.string().min(6).max(50).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Mật khẩu xác nhận không khớp',
    'any.required': 'Xác nhận mật khẩu là bắt buộc',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(50).required(),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Mật khẩu xác nhận không khớp',
  }),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().max(20).allow(''),
  address: Joi.object({
    province: Joi.string().max(50).allow(''),
    district: Joi.string().max(50).allow(''),
    detail: Joi.string().max(200).allow(''),
  }),
}).min(1);

export const banUserSchema = Joi.object({
  reason: Joi.string().max(300).optional().allow(''),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  otp: Joi.string().trim().pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(6).max(50).required(),
  confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Mật khẩu xác nhận không khớp',
  }),
});

export const sendVerificationEmailSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

export const verifyEmailSchema = Joi.object({
  otp: Joi.string().trim().pattern(/^\d{6}$/),
  token: Joi.string().trim(),
}).or('otp', 'token');

export const googleLoginSchema = Joi.object({
  idToken: Joi.string().trim().required(),
});

export const rejectKycSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(5).max(500).required().messages({
    'string.min': 'Lý do từ chối phải có ít nhất 5 ký tự',
    'any.required': 'Lý do từ chối là bắt buộc',
  }),
});
