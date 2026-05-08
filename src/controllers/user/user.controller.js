import * as authService from '../../services/auth/auth.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { toUserResponse } from '../../utils/user.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id)
  sendSuccess(res, {
    message: MESSAGES.AUTH.PROFILE_FETCHED,
    data: {
      user: {
        name: user.name,
        phone: user.phone || '',
        address: {
          province: user.address?.province || '',
          district: user.address?.district || '',
          detail: user.address?.detail || '',
        },
      },
    },
  })
})

export const updateProfile = asyncHandler(async (req, res) => {
  await authService.updateProfile(req.user._id, req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.PROFILE_UPDATED })
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
