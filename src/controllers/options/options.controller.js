import * as optionsService from '../../services/options/options.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'

const sendOptions = (res, data) => sendSuccess(res, { message: 'Options fetched successfully', data })

export const getComboOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getComboOptions())
})

export const getProductFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, await optionsService.getProductFilterOptions())
})

export const getOrderFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getOrderFilterOptions())
})

export const getAdminUsersFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getAdminUsersFilterOptions())
})

export const getShopFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getShopFilterOptions())
})

export const getKycFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getKycFilterOptions())
})

export const getWithdrawalFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getWithdrawalFilterOptions())
})

export const getPaymentOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getPaymentOptions())
})

export const getAnalyticsFilterOptions = asyncHandler(async (req, res) => {
  sendOptions(res, optionsService.getAnalyticsFilterOptions())
})
