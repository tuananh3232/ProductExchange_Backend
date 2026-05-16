import User from '../../models/user.model.js'

export const findByEmail = (email) => User.findOne({ email })

export const findByEmailWithPassword = (email) => User.findOne({ email }).select('+password')

export const findById = (id) => User.findById(id)

export const findByIdWithPassword = (id) => User.findById(id).select('+password')

export const findByIdWithRefreshToken = (id) => User.findById(id).select('+refreshToken')

export const create = (userData) => User.create(userData)

export const updateById = (id, updateData) =>
  User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })

export const saveRefreshToken = (id, refreshToken) =>
  User.findByIdAndUpdate(id, { refreshToken })

export const clearRefreshToken = (id) =>
  User.findByIdAndUpdate(id, { refreshToken: null })

export const findByResetPasswordToken = (hashedToken) =>
  User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires')

export const findByEmailWithResetPasswordToken = (email) =>
  User.findOne({
    email,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+password +resetPasswordToken +resetPasswordExpires')

export const findByIdWithResetPasswordToken = (id) =>
  User.findById(id).select('+password +resetPasswordToken +resetPasswordExpires')

export const findByEmailVerificationToken = (hashedToken) =>
  User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires')

export const findAllByKycStatus = (status, { skip, limit }) =>
  User.find({ 'kyc.status': status })
    .select('name email kyc createdAt')
    .sort({ 'kyc.submittedAt': -1 })
    .skip(skip)
    .limit(limit)

export const countByKycStatus = (status) => User.countDocuments({ 'kyc.status': status })
