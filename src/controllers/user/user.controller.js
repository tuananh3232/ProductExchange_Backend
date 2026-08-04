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

export const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await authService.getAddresses(req.user._id)
  sendSuccess(res, { message: MESSAGES.AUTH.ADDRESSES_FETCHED, data: { addresses } })
})

export const createAddress = asyncHandler(async (req, res) => {
  const address = await authService.createAddress(req.user._id, req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.ADDRESS_CREATED, data: { address } })
})

export const updateAddress = asyncHandler(async (req, res) => {
  const address = await authService.updateAddress(req.user._id, req.params.addressId, req.body)
  sendSuccess(res, { message: MESSAGES.AUTH.ADDRESS_UPDATED, data: { address } })
})

export const deleteAddress = asyncHandler(async (req, res) => {
  const addresses = await authService.deleteAddress(req.user._id, req.params.addressId)
  sendSuccess(res, { message: MESSAGES.AUTH.ADDRESS_DELETED, data: { addresses } })
})

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await authService.setDefaultAddress(req.user._id, req.params.addressId)
  sendSuccess(res, { message: MESSAGES.AUTH.ADDRESS_DEFAULT_UPDATED, data: { address } })
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
  sendSuccess(res, { message: 'Lấy danh sách quyền khả dụng thành công', data: capabilities })
})
