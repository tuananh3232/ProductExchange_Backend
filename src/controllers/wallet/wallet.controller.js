import * as walletService from '../../services/wallet/wallet.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const getWallet = asyncHandler(async (req, res) => {
  const result = await walletService.getWallet(req.params.shopId, req.user)
  sendSuccess(res, { message: 'Lấy thông tin ví thành công', data: result })
})

export const getTransactions = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await walletService.getTransactions(req.params.shopId, req.user, pagination)
  sendSuccess(res, { message: 'Lấy lịch sử giao dịch thành công', data: result.transactions, meta: result.meta })
})

export const requestWithdrawal = asyncHandler(async (req, res) => {
  const result = await walletService.requestWithdrawal(req.params.shopId, req.user, req.body)
  sendSuccess(res, { message: 'Tạo lệnh rút tiền thành công', data: result, statusCode: HTTP_STATUS.CREATED })
})

export const getWithdrawals = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await walletService.getWithdrawals(
    req.params.shopId,
    req.user,
    pagination,
    req.query.status
  )
  sendSuccess(res, { message: 'Lấy danh sách lệnh rút tiền thành công', data: result.withdrawals, meta: result.meta })
})

export const adminGetWithdrawals = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await walletService.adminGetWithdrawals(pagination, req.query.status)
  sendSuccess(res, { message: 'Lấy danh sách lệnh rút tiền thành công', data: result.withdrawals, meta: result.meta })
})

export const adminGetWithdrawalById = asyncHandler(async (req, res) => {
  const withdrawal = await walletService.adminGetWithdrawalById(req.params.withdrawalId || req.params.id)
  sendSuccess(res, { message: 'Lấy chi tiết lệnh rút tiền thành công', data: { withdrawal } })
})

export const approveWithdrawal = asyncHandler(async (req, res) => {
  const result = await walletService.approveWithdrawal(req.params.id, req.user)
  sendSuccess(res, { message: 'Duyệt lệnh rút tiền thành công', data: result })
})

export const rejectWithdrawal = asyncHandler(async (req, res) => {
  const result = await walletService.rejectWithdrawal(
    req.params.id,
    req.user,
    req.body.rejectionReason,
    req.body.adminNote
  )
  sendSuccess(res, { message: 'Từ chối lệnh rút tiền thành công', data: result })
})

export const completeWithdrawal = asyncHandler(async (req, res) => {
  const result = await walletService.completeWithdrawal(req.params.id, req.user, req.body.adminNote, req.body.transferProof)
  sendSuccess(res, { message: 'Xác nhận đã chuyển tiền thành công', data: result })
})
