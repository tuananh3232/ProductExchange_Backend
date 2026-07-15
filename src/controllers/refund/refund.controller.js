import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as service from '../../services/refund/refund.service.js'
import { runLocalReconciliation } from '../../services/accounting/reconciliation.service.js'
import { deleteImage, uploadBuffer } from '../../utils/cloudinary.util.js'

export const createCase = asyncHandler(async (req, res) => {
  const uploaded = []
  try {
    for (const file of req.files ?? []) uploaded.push(await uploadBuffer(file.buffer, 'order-cases'))
    const evidence = uploaded.map(({ url, publicId }) => ({ url, publicId }))
    const orderCase = await service.createOrderCase({ orderId: req.params.orderId, buyerId: req.user._id, ...req.body, evidence })
    sendSuccess(res, { message: 'Đã mở yêu cầu xử lý đơn hàng', data: { orderCase } })
  } catch (error) {
    await Promise.allSettled(uploaded.map(({ publicId }) => deleteImage(publicId)))
    throw error
  }
})

export const respondCase = asyncHandler(async (req, res) => {
  const orderCase = await service.respondOrderCase({
    orderId: req.params.orderId,
    caseId: req.params.caseId,
    userId: req.user._id,
    response: req.body.response,
  })
  sendSuccess(res, { message: 'Đã gửi phản hồi', data: { orderCase } })
})

export const listOrderCases = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listOrderCases(req.query)
  sendSuccess(res, { message: 'Lấy danh sách yêu cầu thành công', data: { orderCases: items }, meta })
})

export const getOrderCase = asyncHandler(async (req, res) => {
  const orderCase = await service.getOrderCase(req.params.caseId)
  if (!orderCase) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu', error: 'ORDER_CASE_NOT_FOUND' })
  sendSuccess(res, { message: 'Lấy yêu cầu thành công', data: { orderCase } })
})

export const listRefunds = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listRefunds(req.query)
  sendSuccess(res, { message: 'Lấy danh sách hoàn tiền thành công', data: { refunds: items }, meta })
})

export const getRefund = asyncHandler(async (req, res) => {
  const refund = await service.getRefund(req.params.refundId)
  if (!refund) return res.status(404).json({ success: false, message: 'Không tìm thấy hoàn tiền', error: 'REFUND_NOT_FOUND' })
  sendSuccess(res, { message: 'Lấy hoàn tiền thành công', data: { refund } })
})

export const listPaymentAttempts = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listPaymentAttempts(req.query)
  sendSuccess(res, { message: 'Lấy danh sách giao dịch thành công', data: { payments: items }, meta })
})

export const getPaymentAttempt = asyncHandler(async (req, res) => {
  const payment = await service.getPaymentAttemptAdmin(req.params.paymentId)
  if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch', error: 'PAYMENT_ATTEMPT_NOT_FOUND' })
  sendSuccess(res, { message: 'Lấy giao dịch thành công', data: { payment } })
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
