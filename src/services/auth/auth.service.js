import * as userRepo from '../../repositories/user/user.repository.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../providers/jwt.provider.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { sendPasswordOtpEmail, sendVerificationOtpEmail } from '../../utils/mail.util.js'
import { env } from '../../configs/env.config.js'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { paginate } from '../../utils/pagination.util.js'
import { ROLES } from '../../constants/role.constant.js'
import { SHOP_STATUS } from '../../constants/status.constant.js'
import Shop from '../../models/shop.model.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const RESET_PASSWORD_EXPIRES_IN_MS = 15 * 60 * 1000
const VERIFY_EMAIL_EXPIRES_IN_MS = 24 * 60 * 60 * 1000
const VERIFY_EMAIL_RESEND_COOLDOWN_MS = 60 * 1000

const createRawToken = () => crypto.randomBytes(32).toString('hex')
const createVerificationOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, '0')
const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex')
const googleClient = new OAuth2Client()
const emptyAvatarPayload = { url: '', publicId: '' }

const ensureUserExists = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  return user
}

const ensureProfileUnlocked = async (userId) => {
  const pendingShop = await Shop.exists({ owner: userId, status: SHOP_STATUS.PENDING_REVIEW, isActive: true })
  if (pendingShop) {
    throw new AppError(
      'Không thể cập nhật hồ sơ khi shop đang chờ xét duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.LOCKED_FOR_REVIEW
    )
  }
}

const normalizeAvatarUrlInput = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('INVALID_PROTOCOL')
    }

    return parsed.toString()
  } catch {
    throw new AppError('Avatar URL không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }
}

const deleteStoredAvatarIfNeeded = async (user) => {
  if (user.avatar?.publicId) {
    await deleteImage(user.avatar.publicId)
  }
}

const dispatchVerificationOtp = async (user, otp) => {
  const sent = await sendVerificationOtpEmail({
    to: user.email,
    name: user.fullName || user.name || 'bạn',
    otp,
  })

  if (!sent && env.nodeEnv === 'production') {
    throw new AppError(
      'Chưa cấu hình gửi email xác minh',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERRORS.AUTH.EMAIL_TRANSPORT_NOT_CONFIGURED
    )
  }
}

const dispatchPasswordOtp = async (user, otp, purpose) => {
  const sent = await sendPasswordOtpEmail({
    to: user.email,
    name: user.name,
    otp,
    purpose,
  })

  if (!sent && env.nodeEnv === 'production') {
    throw new AppError(
      'Chưa cấu hình gửi email đặt lại mật khẩu',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERRORS.AUTH.EMAIL_TRANSPORT_NOT_CONFIGURED
    )
  }
}

const issueAuthTokens = async (user) => {
  const payload = { userId: user._id.toString(), roles: user.roles || [] }
  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  await userRepo.saveRefreshToken(user._id, refreshToken)

  return {
    user: user.toPublicJSON(),
    accessToken,
    refreshToken,
  }
}

export const register = async ({ name, email, password }) => {
  const existingUser = await userRepo.findByEmail(email)
  if (existingUser) {
    throw new AppError('Email đã được sử dụng', HTTP_STATUS.CONFLICT, ERRORS.AUTH.EMAIL_ALREADY_EXISTS)
  }

  const user = await userRepo.create({ name, email, password })

  // Auto-generate verification OTP for email confirmation
  const verificationOtp = createVerificationOtp()
  user.emailVerificationToken = hashToken(verificationOtp)
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_EMAIL_EXPIRES_IN_MS)
  await user.save()

  await dispatchVerificationOtp(user, verificationOtp)

  const result = { user: user.toPublicJSON() }

  if (env.nodeEnv !== 'production') {
    result.debugOtp = verificationOtp
  }

  return result
}

export const login = async ({ email, password }) => {
  const user = await userRepo.findByEmailWithPassword(email)
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.INVALID_CREDENTIALS)
  }

  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE)
  }

  if (!user.isVerified) {
    throw new AppError('Vui lòng xác thực email trước khi đăng nhập', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.EMAIL_NOT_VERIFIED)
  }

  return issueAuthTokens(user)
}

export const loginWithGoogle = async ({ idToken }) => {
  if (!env.google.clientId) {
    throw new AppError(
      'Chưa cấu hình đăng nhập Google',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERRORS.AUTH.GOOGLE_OAUTH_NOT_CONFIGURED
    )
  }

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.google.clientId,
    })
    payload = ticket.getPayload()
  } catch {
    throw new AppError(
      'Google token không hợp lệ',
      HTTP_STATUS.UNAUTHORIZED,
      ERRORS.AUTH.GOOGLE_TOKEN_INVALID
    )
  }

  const email = payload?.email?.toLowerCase?.()
  if (!email) {
    throw new AppError('Không lấy được email từ Google', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.GOOGLE_TOKEN_INVALID)
  }

  if (!payload.email_verified) {
    throw new AppError(
      'Email Google chưa được xác minh',
      HTTP_STATUS.FORBIDDEN,
      ERRORS.AUTH.GOOGLE_EMAIL_NOT_VERIFIED
    )
  }

  let user = await userRepo.findByEmail(email)

  if (!user) {
    const generatedPassword = crypto.randomBytes(24).toString('hex')
    user = await userRepo.create({
      name: payload.name || email.split('@')[0],
      email,
      password: generatedPassword,
      isVerified: true,
      emailVerifiedAt: new Date(),
      avatar: {
        url: payload.picture || '',
        publicId: '',
      },
    })
  } else {
    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE)
    }

    if (!user.isVerified) {
      user.isVerified = true
      user.emailVerifiedAt = new Date()
    }

    if (payload.picture && !user.avatar?.url) {
      user.avatar = {
        url: payload.picture,
        publicId: user.avatar?.publicId || '',
      }
    }

    await user.save()
  }

  return issueAuthTokens(user)
}

export const refreshToken = async (token) => {
  let decoded
  try {
    decoded = verifyRefreshToken(token)
  } catch {
    throw new AppError('Phiên làm việc không hợp lệ', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.REFRESH_TOKEN_INVALID)
  }

  const user = await userRepo.findByIdWithRefreshToken(decoded.userId)
  if (!user || user.refreshToken !== token) {
    throw new AppError('Phiên làm việc không hợp lệ', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.REFRESH_TOKEN_INVALID)
  }

  const payload = { userId: user._id.toString(), roles: user.roles || [] }
  const newAccessToken = generateAccessToken(payload)
  const newRefreshToken = generateRefreshToken(payload)
  await userRepo.saveRefreshToken(user._id, newRefreshToken)

  return { user: user.toPublicJSON(), accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export const logout = async (userId) => {
  await userRepo.clearRefreshToken(userId)
}

export const getProfile = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  return user.toPublicJSON()
}

export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const currentUser = await userRepo.findById(userId)
  if (!currentUser) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const user = await userRepo.findByEmailWithPassword(currentUser.email)
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Mật khẩu hiện tại không đúng', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.WRONG_PASSWORD)
  }
  user.password = newPassword
  await user.save()
}

export const updateProfile = async (userId, updateData) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const pendingShop = await Shop.exists({ owner: userId, status: SHOP_STATUS.PENDING_REVIEW, isActive: true })
  if (pendingShop) {
    throw new AppError(
      'Không thể cập nhật hồ sơ khi shop đang chờ xét duyệt',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.SHOP.LOCKED_FOR_REVIEW
    )
  }

  if (updateData.name) user.name = updateData.name
  if (updateData.phone !== undefined) user.phone = updateData.phone
  if (updateData.address) {
    user.address = { ...user.address, ...updateData.address }
  }

  await user.save()
  return user.toPublicJSON()
}

export const updateAvatar = async (userId, { file, avatarUrl, removeAvatar = false }) => {
  const user = await ensureUserExists(userId)
  await ensureProfileUnlocked(userId)

  const hasFile = Boolean(file?.buffer)
  const normalizedAvatarUrl = normalizeAvatarUrlInput(avatarUrl)
  const shouldRemoveAvatar = removeAvatar === true || removeAvatar === 'true' || (!hasFile && avatarUrl === '')

  if (hasFile && normalizedAvatarUrl) {
    throw new AppError(
      'Chỉ được gửi một trong hai: file avatar hoặc avatarUrl',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.VALIDATION.INVALID_FORMAT
    )
  }

  if (!hasFile && !normalizedAvatarUrl && !shouldRemoveAvatar) {
    throw new AppError(
      'Vui lòng cung cấp file avatar hoặc avatarUrl',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.VALIDATION.REQUIRED
    )
  }

  if (shouldRemoveAvatar) {
    await deleteStoredAvatarIfNeeded(user)
    user.avatar = { ...emptyAvatarPayload }
    await user.save()
    return user.toPublicJSON()
  }

  await deleteStoredAvatarIfNeeded(user)

  if (hasFile) {
    user.avatar = await uploadBuffer(file.buffer, 'avatars/users')
  } else {
    user.avatar = {
      url: normalizedAvatarUrl,
      publicId: '',
    }
  }

  await user.save()
  return user.toPublicJSON()
}

export const banUser = async (userId, reason = '') => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  user.isActive = false
  await user.save()
  await notifySafely({
    recipient: user._id,
    type: NOTIFICATION_TYPES.USER_BLOCKED,
    title: 'Tài khoản đã bị khóa',
    message: reason || 'Tài khoản của bạn đã bị khóa',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetId: user._id,
    actionUrl: '/profile',
    data: { reason },
  })
  return user.toPublicJSON()
}

export const unbanUser = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  user.isActive = true
  await user.save()
  await notifySafely({
    recipient: user._id,
    type: NOTIFICATION_TYPES.USER_UNBLOCKED,
    title: 'Tài khoản đã được mở khóa',
    message: 'Tài khoản của bạn đã được mở khóa',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetId: user._id,
    actionUrl: '/profile',
  })
  return user.toPublicJSON()
}

export const getAdminUsers = async (query, pagination) => {
  const filter = {}

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ]
  }

  const roleFilter = query.role || query.roles
  if (roleFilter) {
    filter.roles = { $in: String(roleFilter).split(',').map((role) => role.trim()).filter(Boolean) }
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true
  }

  const { items: users, meta } = await paginate(userRepo, filter, pagination)

  return {
    users: users.map((user) => user.toPublicJSON()),
    meta,
  }
}

export const forgotPassword = async ({ email }) => {
  const user = await userRepo.findByEmail(email)
  if (!user) {
    return { issued: false }
  }

  if (!user.isVerified) {
    return { issued: false }
  }

  const rawToken = createVerificationOtp()
  user.resetPasswordToken = hashToken(rawToken)
  user.resetPasswordExpires = new Date(Date.now() + RESET_PASSWORD_EXPIRES_IN_MS)
  await user.save()

  await dispatchPasswordOtp(user, rawToken, 'đặt lại mật khẩu')

  if (env.nodeEnv !== 'production') {
    return { issued: true, debugOtp: rawToken }
  }

  return { issued: true }
}

export const resetPassword = async ({ email, otp, newPassword }) => {
  const user = await userRepo.findByEmailWithResetPasswordToken(email)
  if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
    throw new AppError('Mã OTP không hợp lệ hoặc đã hết hạn', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.RESET_TOKEN_INVALID)
  }

  const hashed = hashToken(otp)
  if (hashed !== user.resetPasswordToken) {
    throw new AppError('Mã OTP không hợp lệ hoặc đã hết hạn', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.RESET_TOKEN_INVALID)
  }

  user.password = newPassword
  user.resetPasswordToken = null
  user.resetPasswordExpires = null
  user.refreshToken = null
  await user.save()
}

export const sendVerificationEmail = async ({ email }) => {
  const user = await userRepo.findByEmailWithVerificationToken(email)
  if (!user) {
    return { issued: false }
  }

  if (user.isVerified) {
    return { issued: false, alreadyVerified: true }
  }

  const expiresAt = user.emailVerificationExpires?.getTime?.()
  const issuedAt = expiresAt ? expiresAt - VERIFY_EMAIL_EXPIRES_IN_MS : 0
  const hasFreshPendingOtp =
    user.emailVerificationToken &&
    expiresAt > Date.now() &&
    issuedAt > Date.now() - VERIFY_EMAIL_RESEND_COOLDOWN_MS

  if (hasFreshPendingOtp) {
    return { issued: false, cooldown: true }
  }

  const verificationOtp = createVerificationOtp()
  user.emailVerificationToken = hashToken(verificationOtp)
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_EMAIL_EXPIRES_IN_MS)
  await user.save()

  await dispatchVerificationOtp(user, verificationOtp)

  if (env.nodeEnv !== 'production') {
    return { issued: true, debugOtp: verificationOtp }
  }

  return { issued: true }
}

export const submitKyc = async (userId, { fullName, idNumber }, files) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  if (user.kyc?.status === 'approved') {
    throw new AppError('Hồ sơ KYC đã được xác minh, không thể cập nhật', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.ALREADY_APPROVED)
  }

  const frontBuffer = files?.frontImage?.[0]?.buffer
  const backBuffer = files?.backImage?.[0]?.buffer
  if (!frontBuffer || !backBuffer) {
    throw new AppError('Vui lòng cung cấp ảnh mặt trước và mặt sau CCCD', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.IMAGE_REQUIRED)
  }

  if (user.kyc?.frontImage?.publicId) await deleteImage(user.kyc.frontImage.publicId)
  if (user.kyc?.backImage?.publicId) await deleteImage(user.kyc.backImage.publicId)

  const [frontImage, backImage] = await Promise.all([
    uploadBuffer(frontBuffer, 'kyc'),
    uploadBuffer(backBuffer, 'kyc'),
  ])

  user.kyc = {
    fullName: fullName.trim(),
    idNumber: idNumber.trim(),
    frontImage,
    backImage,
    status: 'pending',
    rejectionReason: '',
    submittedAt: new Date(),
    reviewedAt: null,
  }

  await user.save()
  await notifySafely({
    recipient: user._id,
    type: NOTIFICATION_TYPES.KYC_SUBMITTED,
    title: 'Hồ sơ KYC đã được gửi',
    message: 'Hồ sơ KYC của bạn đang chờ xét duyệt',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetId: user._id,
    actionUrl: '/profile',
  })
  return user.toPublicJSON()
}

export const getMyKyc = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return { kyc: user.kyc || { status: 'none' } }
}

export const adminGetAllKyc = async (query, pagination) => {
  const { page, limit } = pagination
  const skip = (page - 1) * limit

  const [users, total] = query.status
    ? await Promise.all([
        userRepo.findAllByKycStatus(query.status, { skip, limit }),
        userRepo.countByKycStatus(query.status),
      ])
    : await Promise.all([
        userRepo.findAllKyc({ skip, limit }),
        userRepo.countAllKyc(),
      ])

  return {
    users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export const adminGetUserKyc = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return { user: user.toPublicJSON() }
}

export const getAdminKycs = async (query, pagination) => {
  const filter = {}
  const allowedStatuses = ['pending', 'approved', 'rejected', 'none']

  if (query.status) {
    if (!allowedStatuses.includes(query.status)) {
      throw new AppError('Trạng thái KYC không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
    filter['kyc.status'] = query.status
  } else {
    filter['kyc.status'] = { $ne: 'none' }
  }

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { 'kyc.fullName': { $regex: query.search, $options: 'i' } },
    ]
  }

  const { items: users, meta } = await paginate(userRepo, filter, pagination)

  return {
    kycs: users.map((user) => ({
      user: user.toPublicJSON(),
      kyc: user.kyc || { status: 'none' },
    })),
    meta,
  }
}

export const adminApproveKyc = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  if (!user.kyc || user.kyc.status !== 'pending') {
    throw new AppError('Hồ sơ KYC không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.NOT_PENDING)
  }

  user.kyc.status = 'approved'
  user.kyc.reviewedAt = new Date()
  user.kyc.rejectionReason = ''
  user.roles = [...new Set([...(user.roles || []), ROLES.SELLER])]
  await user.save()
  await notifySafely({
    recipient: user._id,
    type: NOTIFICATION_TYPES.KYC_APPROVED,
    title: 'KYC đã được phê duyệt',
    message: 'Hồ sơ KYC của bạn đã được phê duyệt và quyền seller đã được cấp',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetId: user._id,
    actionUrl: '/profile',
  })
  return user.toPublicJSON()
}

export const adminRejectKyc = async (userId, rejectionReason) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  if (!user.kyc || user.kyc.status !== 'pending') {
    throw new AppError('Hồ sơ KYC không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.KYC.NOT_PENDING)
  }

  user.kyc.status = 'rejected'
  user.kyc.reviewedAt = new Date()
  user.kyc.rejectionReason = rejectionReason
  await user.save()
  await notifySafely({
    recipient: user._id,
    type: NOTIFICATION_TYPES.KYC_REJECTED,
    title: 'KYC bị từ chối',
    message: 'Hồ sơ KYC của bạn bị từ chối',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetId: user._id,
    actionUrl: '/profile',
    data: { rejectionReason },
  })
  return user.toPublicJSON()
}

export const verifyEmail = async ({ token, otp }) => {
  const verificationCode = otp || token
  const hashed = hashToken(verificationCode)
  const user = await userRepo.findByEmailVerificationToken(hashed)

  if (!user) {
    throw new AppError('Mã xác minh email không hợp lệ hoặc đã hết hạn', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.VERIFY_EMAIL_CODE_INVALID)
  }

  user.isVerified = true
  user.emailVerifiedAt = new Date()
  user.emailVerificationToken = null
  user.emailVerificationExpires = null
  await user.save()

  return user.toPublicJSON()
}
