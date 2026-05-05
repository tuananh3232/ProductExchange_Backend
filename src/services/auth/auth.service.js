import * as userRepo from '../../repositories/user/user.repository.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../providers/jwt.provider.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { env } from '../../configs/env.config.js'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'

const RESET_PASSWORD_EXPIRES_IN_MS = 15 * 60 * 1000
const VERIFY_EMAIL_EXPIRES_IN_MS = 24 * 60 * 60 * 1000

const createRawToken = () => crypto.randomBytes(32).toString('hex')
const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex')
const googleClient = new OAuth2Client()

const issueAuthTokens = async (user) => {
  const payload = { userId: user._id.toString(), role: user.role }
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
  return user.toPublicJSON()
}

export const login = async ({ email, password }) => {
  const user = await userRepo.findByEmailWithPassword(email)
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', HTTP_STATUS.UNAUTHORIZED, ERRORS.AUTH.INVALID_CREDENTIALS)
  }

  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị khóa', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.ACCOUNT_INACTIVE)
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

  const payload = { userId: user._id.toString(), role: user.role }
  const newAccessToken = generateAccessToken(payload)
  const newRefreshToken = generateRefreshToken(payload)
  await userRepo.saveRefreshToken(user._id, newRefreshToken)

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
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
  await user.save() // Kích hoạt pre-save hook hash password
}

export const updateProfile = async (userId, updateData) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  if (updateData.name) user.name = updateData.name
  if (updateData.phone !== undefined) user.phone = updateData.phone
  if (updateData.address) {
    user.address = { ...user.address, ...updateData.address }
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
  return user.toPublicJSON()
}

export const unbanUser = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  user.isActive = true
  await user.save()
  return user.toPublicJSON()
}

export const forgotPassword = async ({ email }) => {
  const user = await userRepo.findByEmail(email)
  if (!user) {
    return { issued: false }
  }

  const rawToken = createRawToken()
  user.resetPasswordToken = hashToken(rawToken)
  user.resetPasswordExpires = new Date(Date.now() + RESET_PASSWORD_EXPIRES_IN_MS)
  await user.save()

  if (env.nodeEnv !== 'production') {
    return { issued: true, debugToken: rawToken }
  }

  return { issued: true }
}

export const resetPassword = async ({ token, newPassword }) => {
  const hashed = hashToken(token)
  const user = await userRepo.findByResetPasswordToken(hashed)
  if (!user) {
    throw new AppError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.RESET_TOKEN_INVALID)
  }

  user.password = newPassword
  user.resetPasswordToken = null
  user.resetPasswordExpires = null
  user.refreshToken = null
  await user.save()
}

export const sendVerificationEmail = async ({ email }) => {
  const user = await userRepo.findByEmail(email)
  if (!user) {
    return { issued: false }
  }

  if (user.isVerified) {
    return { issued: false, alreadyVerified: true }
  }

  const rawToken = createRawToken()
  user.emailVerificationToken = hashToken(rawToken)
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_EMAIL_EXPIRES_IN_MS)
  await user.save()

  if (env.nodeEnv !== 'production') {
    return { issued: true, debugToken: rawToken }
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
  return user.toPublicJSON()
}

export const getMyKyc = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return { kyc: user.kyc || { status: 'none' } }
}

export const adminGetUserKyc = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return { user: user.toPublicJSON() }
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
  await user.save()
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
  return user.toPublicJSON()
}

export const verifyEmail = async ({ token }) => {
  const hashed = hashToken(token)
  const user = await userRepo.findByEmailVerificationToken(hashed)

  if (!user) {
    throw new AppError('Liên kết xác minh email không hợp lệ hoặc đã hết hạn', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.VERIFY_EMAIL_TOKEN_INVALID)
  }

  user.isVerified = true
  user.emailVerifiedAt = new Date()
  user.emailVerificationToken = null
  user.emailVerificationExpires = null
  await user.save()

  return user.toPublicJSON()
}
