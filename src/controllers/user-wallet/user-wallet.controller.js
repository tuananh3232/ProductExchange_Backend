import * as userWalletService from '../../services/user-wallet/user-wallet.service.js'
import * as paymentService from '../../services/payment/payment.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const getMyWallet = asyncHandler(async (req, res) => {
  const result = await userWalletService.getMyWallet(req.user._id)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.FETCHED, data: result })
})

export const getMyTransactions = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await userWalletService.getMyTransactions(req.user._id, pagination)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.TRANSACTIONS_FETCHED,
    data: result.transactions,
    meta: result.meta,
  })
})

export const getMyTopups = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await userWalletService.getMyTopups(req.user._id, pagination)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.TOPUPS_FETCHED,
    data: result.topups,
    meta: result.meta,
  })
})

export const getMyActivity = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await userWalletService.getMyActivity(req.user._id, pagination)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.ACTIVITY_FETCHED,
    data: result.activities,
    meta: result.meta,
  })
})

export const createTopup = asyncHandler(async (req, res) => {
  const result = await paymentService.createWalletTopup(req.body.amount, req.user)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.TOPUP_CREATED,
    data: result,
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const payOrderWithWallet = asyncHandler(async (req, res) => {
  const result = await userWalletService.payOrderWithWallet(req.body.orderId, req.user)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.ORDER_PAID, data: result })
})

export const verifyTopup = asyncHandler(async (req, res) => {
  const orderCode = req.body.orderCode ?? req.query.orderCode
  const result = await paymentService.handleTopupReturn({ orderCode }, req.user._id)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.TOPUP_CALLBACK_PROCESSED, data: result })
})

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const result = await userWalletService.requestWithdrawal(req.user, req.body)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.WITHDRAWAL_REQUESTED,
    data: result,
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const statusFilter = req.query.status || null
  const result = await userWalletService.getMyWithdrawals(req.user._id, pagination, statusFilter)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.WITHDRAWALS_FETCHED,
    data: result.withdrawals,
    meta: result.meta,
  })
})

export const adminGetUserWithdrawals = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const statusFilter = req.query.status || null
  const result = await userWalletService.adminGetUserWithdrawals(pagination, statusFilter)
  sendSuccess(res, {
    message: MESSAGES.USER_WALLET.WITHDRAWALS_FETCHED,
    data: result.withdrawals,
    meta: result.meta,
  })
})

export const approveUserWithdrawal = asyncHandler(async (req, res) => {
  const result = await userWalletService.approveUserWithdrawal(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.WITHDRAWAL_APPROVED, data: result })
})

export const rejectUserWithdrawal = asyncHandler(async (req, res) => {
  const { rejectionReason, adminNote } = req.body
  const result = await userWalletService.rejectUserWithdrawal(req.params.id, req.user, rejectionReason, adminNote)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.WITHDRAWAL_REJECTED, data: result })
})

export const completeUserWithdrawal = asyncHandler(async (req, res) => {
  const { adminNote, transferProof } = req.body
  const result = await userWalletService.completeUserWithdrawal(req.params.id, req.user, adminNote, transferProof)
  sendSuccess(res, { message: MESSAGES.USER_WALLET.WITHDRAWAL_COMPLETED, data: result })
})
