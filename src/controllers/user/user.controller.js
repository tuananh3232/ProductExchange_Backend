import * as authService from '../../services/auth/auth.service.js'
import * as capabilityService from '../../services/user/capability.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { toUserResponse } from '../../utils/user.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id)
  sendSuccess(res, {
    message: MESSAGES.AUTH.PROFILE_FETCHED,
    data: {
      user: toUserResponse(user),
    },
  })
})

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.PROFILE_UPDATED, data: { user: toUserResponse(user) } })
})

export const updateAvatar = asyncHandler(async (req, res) => {
  const user = await authService.updateAvatar(req.user._id, {
    file: req.file,
    avatarUrl: req.body?.avatarUrl,
    removeAvatar: req.body?.removeAvatar,
  })
  sendSuccess(res, { message: MESSAGES.AUTH.AVATAR_UPDATED, data: { user: toUserResponse(user) } })
})

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.PASSWORD_CHANGED })
})

export const submitKyc = asyncHandler(async (req, res) => {
  const { fullName, idNumber } = req.body
  const user = await authService.submitKyc(req.user._id, { fullName, idNumber }, req.files)
  sendSuccess(res, { message: MESSAGES.KYC.SUBMITTED, data: { user } })
})

export const getMyKyc = asyncHandler(async (req, res) => {
  const result = await authService.getMyKyc(req.user._id)
  sendSuccess(res, { message: MESSAGES.KYC.FETCHED, data: result })
})

export const getMyCapabilities = asyncHandler(async (req, res) => {
  const capabilities = await capabilityService.getUserCapabilities(req.user.roles)
  sendSuccess(res, { message: 'Capabilities fetched successfully', data: capabilities })
})
