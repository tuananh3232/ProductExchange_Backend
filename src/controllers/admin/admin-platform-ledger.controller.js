import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import * as ledgerService from '../../services/ledger/ledger.service.js'

export const getPlatformLedgerTransactions = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { transactions, meta } = await ledgerService.getPlatformLedgerTransactions(req.query, pagination)
  sendSuccess(res, {
    message: 'Lấy danh sách platform ledger thành công',
    data: { transactions },
    meta,
  })
})

export const getPlatformLedgerTransactionById = asyncHandler(async (req, res) => {
  const result = await ledgerService.getPlatformLedgerTransactionById(req.params.transactionId)
  sendSuccess(res, {
    message: 'Lấy chi tiết platform ledger thành công',
    data: result,
  })
})

export const getPlatformWalletSummary = asyncHandler(async (req, res) => {
  const summary = await ledgerService.getPlatformWalletSummary()
  sendSuccess(res, {
    message: 'Lấy tổng hợp platform wallet thành công',
    data: summary,
  })
})

export const exportPlatformLedger = asyncHandler(async (req, res) => {
  const exported = await ledgerService.exportPlatformLedgerTransactions(req.query)
  sendSuccess(res, {
    message: 'Xuất platform ledger thành công',
    data: exported,
  })
})
