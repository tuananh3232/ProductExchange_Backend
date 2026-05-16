import * as authService from '../../services/auth/auth.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { toUserResponse } from '../../utils/user.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body)
  sendSuccess(res, {
    message: MESSAGES.AUTH.REGISTER_SUCCESS,
    data: { user: toUserResponse(user) },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body)
  sendSuccess(res, {
    message: MESSAGES.AUTH.LOGIN_SUCCESS,
    data: {
      user: toUserResponse(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  })
})

export const googleLogin = asyncHandler(async (req, res) => {
  const result = await authService.loginWithGoogle(req.body)
  sendSuccess(res, {
    message: MESSAGES.AUTH.GOOGLE_LOGIN_SUCCESS,
    data: {
      user: toUserResponse(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  })
})

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body
  const result = await authService.refreshToken(token)
  sendSuccess(res, {
    message: MESSAGES.AUTH.REFRESH_TOKEN_SUCCESS,
    data: {
      user: toUserResponse(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  })
})

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id)
  sendSuccess(res, { message: MESSAGES.AUTH.LOGOUT_SUCCESS })
})

export const banUser = asyncHandler(async (req, res) => {
  const user = await authService.banUser(req.params.userId)
  sendSuccess(res, { message: MESSAGES.USER.BANNED, data: { user } })
})

export const unbanUser = asyncHandler(async (req, res) => {
  const user = await authService.unbanUser(req.params.userId)
  sendSuccess(res, { message: MESSAGES.USER.UNBANNED, data: { user } })
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body)
  const data = result.debugOtp ? { debugOtp: result.debugOtp } : null
  sendSuccess(res, { message: MESSAGES.AUTH.FORGOT_PASSWORD_SENT, data })
})

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.PASSWORD_RESET_SUCCESS })
})

export const sendVerificationEmail = asyncHandler(async (req, res) => {
  const result = await authService.sendVerificationEmail(req.body)
  if (result.alreadyVerified) {
    return sendSuccess(res, { message: MESSAGES.AUTH.EMAIL_ALREADY_VERIFIED })
  }
  const data = result.debugOtp ? { debugOtp: result.debugOtp } : null
  return sendSuccess(res, { message: MESSAGES.AUTH.VERIFICATION_EMAIL_SENT, data })
})

export const adminGetAllKyc = asyncHandler(async (req, res) => {
  const { status } = req.query
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 20
  const result = await authService.adminGetAllKyc({ status }, { page, limit })
  sendSuccess(res, { message: MESSAGES.KYC.FETCHED_ALL, data: result })
})

export const adminGetUserKyc = asyncHandler(async (req, res) => {
  const result = await authService.adminGetUserKyc(req.params.userId)
  sendSuccess(res, { message: MESSAGES.KYC.FETCHED, data: result })
})

export const adminApproveKyc = asyncHandler(async (req, res) => {
  const user = await authService.adminApproveKyc(req.params.userId)
  sendSuccess(res, { message: MESSAGES.KYC.APPROVED, data: { user } })
})

export const adminRejectKyc = asyncHandler(async (req, res) => {
  const user = await authService.adminRejectKyc(req.params.userId, req.body.rejectionReason)
  sendSuccess(res, { message: MESSAGES.KYC.REJECTED, data: { user } })
})

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await authService.verifyEmail(req.body)
  sendSuccess(res, {
    message: MESSAGES.AUTH.EMAIL_VERIFIED,
    data: { user: toUserResponse(user) },
  })
})
