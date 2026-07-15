import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as service from '../../services/refund/refund.service.js'
import { runLocalReconciliation } from '../../services/accounting/reconciliation.service.js'

export const createCase = asyncHandler(async (req, res) => {
  const orderCase = await service.createOrderCase({ orderId: req.params.orderId, buyerId: req.user._id, ...req.body })
  sendSuccess(res, { message: 'Đã mở yêu cầu xử lý đơn hàng', data: { orderCase } })
})

export const resolveCase = asyncHandler(async (req, res) => {
  const result = await service.resolveOrderCase({
    caseId: req.params.caseId,
    adminId: req.user._id,
    idempotencyKey: req.get('idempotency-key'),
    ...req.body,
  })
  sendSuccess(res, { message: 'Đã giải quyết case', data: result })
})

export const processRefund = asyncHandler(async (req, res) => {
  const refund = await service.processRefund(req.params.refundId, req.user._id)
  sendSuccess(res, { message: 'Đã xử lý hoàn tiền', data: { refund } })
})

export const confirmManual = asyncHandler(async (req, res) => {
  const refund = await service.confirmManualRefund({ refundId: req.params.refundId, adminId: req.user._id, evidence: req.body.evidence })
  sendSuccess(res, { message: 'Đã xác nhận hoàn tiền thủ công', data: { refund } })
})

export const reconciliationIssues = asyncHandler(async (req, res) => {
  const issues = await service.listReconciliationIssues()
  sendSuccess(res, { message: 'Lấy danh sách sai lệch thành công', data: { issues } })
})

export const runReconciliation = asyncHandler(async (req, res) => {
  const result = await runLocalReconciliation()
  sendSuccess(res, { message: 'Đối soát nội bộ hoàn tất', data: { result } })
})
