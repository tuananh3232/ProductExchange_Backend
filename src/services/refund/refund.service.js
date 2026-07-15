import Order from '../../models/order.model.js'
import OrderCase from '../../models/order-case.model.js'
import PaymentAttempt from '../../models/payment-attempt.model.js'
import Refund from '../../models/refund.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { COMMERCE_ORDER_STATUS, REFUND_STATUS } from '../../constants/commerce.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'
import ReconciliationIssue from '../../models/reconciliation-issue.model.js'
import { env } from '../../configs/env.config.js'
import { vnpayProvider } from '../../providers/vnpay.provider.js'

const refundableStatuses = [
  COMMERCE_ORDER_STATUS.PAID_HELD,
  COMMERCE_ORDER_STATUS.SELLER_CONFIRMED,
  COMMERCE_ORDER_STATUS.PROCESSING,
  COMMERCE_ORDER_STATUS.SHIPPED,
  COMMERCE_ORDER_STATUS.DELIVERED_PENDING_CONFIRMATION,
  COMMERCE_ORDER_STATUS.RETURN_REQUESTED,
  COMMERCE_ORDER_STATUS.DISPUTED,
]

export const createOrderCase = async ({ orderId, buyerId, type, reason, evidence = [] }) => runRequiredMongoTransaction(async (session) => {
  const order = await Order.findOne({ _id: orderId, buyer: buyerId }).session(session)
  if (!order) throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, 'ORDER_NOT_FOUND')
  if (!refundableStatuses.includes(order.commerceStatus)) {
    throw new AppError('Đơn hàng không nằm trong thời hạn khiếu nại', HTTP_STATUS.CONFLICT, 'ORDER_CASE_WINDOW_CLOSED')
  }
  if (order.deliveredAt) {
    const deadline = new Date(order.deliveredAt).getTime() + env.commerce.caseWindowHours * 60 * 60 * 1000
    if (Date.now() > deadline) {
      throw new AppError('Đã hết thời hạn khiếu nại', HTTP_STATUS.CONFLICT, 'ORDER_CASE_WINDOW_CLOSED')
    }
  }
  const existing = await OrderCase.findOne({ order: order._id, status: { $in: ['open', 'seller_responded', 'under_review'] } }).session(session)
  if (existing) return existing
  const [orderCase] = await OrderCase.create([{
    order: order._id,
    openedBy: buyerId,
    type,
    reason,
    evidence,
  }], { session })
  order.commerceStatus = type === 'dispute' ? COMMERCE_ORDER_STATUS.DISPUTED : COMMERCE_ORDER_STATUS.RETURN_REQUESTED
  await order.save({ session })
  return orderCase
})

export const resolveOrderCase = async ({ caseId, adminId, resolution, amount = 0, note = '', idempotencyKey }) => runRequiredMongoTransaction(async (session) => {
  const orderCase = await OrderCase.findOne({ _id: caseId, status: { $in: ['open', 'seller_responded', 'under_review'] } }).session(session)
  if (!orderCase) throw new AppError('Case đã được xử lý hoặc không tồn tại', HTTP_STATUS.CONFLICT, 'ORDER_CASE_NOT_OPEN')
  const order = await Order.findById(orderCase.order).session(session)
  let refund = null
  if (['full_refund', 'partial_refund'].includes(resolution)) {
    const payment = await PaymentAttempt.findOne({ orders: order._id, status: 'succeeded' }).session(session)
    if (!payment) throw new AppError('Không tìm thấy thanh toán đã xác minh', HTTP_STATUS.CONFLICT, 'CAPTURED_PAYMENT_NOT_FOUND')
    const capturedForOrder = Number(order.amountBreakdown?.total || order.totalAmount)
    const refunded = await Refund.aggregate([
      { $match: { order: order._id, status: { $in: [REFUND_STATUS.PROCESSING, REFUND_STATUS.SUCCEEDED, REFUND_STATUS.MANUAL_REQUIRED] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).session(session)
    const refundAmount = resolution === 'full_refund' ? capturedForOrder - (refunded[0]?.total || 0) : Number(amount)
    if (refundAmount <= 0 || refundAmount + (refunded[0]?.total || 0) > capturedForOrder) {
      throw new AppError('Số tiền hoàn vượt quá số tiền đã thu', HTTP_STATUS.BAD_REQUEST, 'REFUND_AMOUNT_EXCEEDED')
    }
    const existing = await Refund.findOne({ idempotencyKey }).session(session)
    if (existing) refund = existing
    else [refund] = await Refund.create([{
      order: order._id,
      paymentAttempt: payment._id,
      orderCase: orderCase._id,
      buyer: order.buyer,
      amount: refundAmount,
      reason: note || orderCase.reason,
      source: payment.provider,
      idempotencyKey,
    }], { session })
  } else if (resolution === 'complete') {
    order.commerceStatus = COMMERCE_ORDER_STATUS.DELIVERED_PENDING_CONFIRMATION
    await order.save({ session })
  }
  orderCase.status = resolution === 'reject' ? 'rejected' : 'resolved'
  orderCase.resolution = resolution
  orderCase.resolutionAmount = refund?.amount || 0
  orderCase.resolutionNote = note
  orderCase.resolvedBy = adminId
  orderCase.resolvedAt = new Date()
  await orderCase.save({ session })
  return { orderCase, refund }
})

const updateOrderRefundStatus = async (refund, session) => {
  const successful = await Refund.aggregate([
    { $match: { order: refund.order, status: REFUND_STATUS.SUCCEEDED } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).session(session)
  const order = await Order.findById(refund.order).session(session)
  order.commerceStatus = (successful[0]?.total || 0) >= Number(order.amountBreakdown?.total || order.totalAmount)
    ? COMMERCE_ORDER_STATUS.REFUNDED
    : COMMERCE_ORDER_STATUS.PARTIALLY_REFUNDED
  await order.save({ session })
}

const processVnpayRefund = async (refundId, adminId) => {
  const prepared = await runRequiredMongoTransaction(async (session) => {
    const refund = await Refund.findOne({ _id: refundId, status: REFUND_STATUS.REQUESTED }).session(session)
    if (!refund) throw new AppError('Yêu cầu hoàn tiền đã được xử lý', HTTP_STATUS.CONFLICT, 'REFUND_NOT_REQUESTED')
    const order = await Order.findById(refund.order).session(session)
    const payment = await PaymentAttempt.findById(refund.paymentAttempt).session(session)
    if (!payment?.providerReference || !payment.providerTransactionDate) {
      throw new AppError('Thiếu dữ liệu giao dịch VNPay để hoàn tiền', HTTP_STATUS.CONFLICT, 'VNPAY_REFUND_DATA_MISSING')
    }
    await postBalancedTransaction({
      commandKey: `refund_reserve:${refund._id}`,
      transactionType: 'refund_reserve',
      referenceType: 'Refund',
      referenceId: refund._id,
      entries: [
        { account: accountDefinitions.orderEscrow(order.checkout), direction: 'debit', amount: refund.amount },
        { account: accountDefinitions.refundPayable(refund._id), direction: 'credit', amount: refund.amount },
      ],
    }, session)
    refund.status = REFUND_STATUS.PROCESSING
    refund.processedBy = adminId
    await refund.save({ session })
    return {
      refundId: refund._id,
      amount: refund.amount,
      paymentAmount: payment.amount,
      merchantReference: payment.merchantReference,
      transactionNo: payment.providerReference,
      transactionDate: payment.providerTransactionDate,
    }
  })

  let providerResult
  try {
    providerResult = await vnpayProvider.refund({
      requestId: String(prepared.refundId),
      transactionType: prepared.amount === prepared.paymentAmount ? '02' : '03',
      merchantReference: prepared.merchantReference,
      amount: prepared.amount,
      transactionNo: prepared.transactionNo,
      transactionDate: prepared.transactionDate,
      createBy: adminId,
      ipAddress: '127.0.0.1',
    })
  } catch (error) {
    await ReconciliationIssue.create({
      issueKey: `vnpay-refund-provider:${prepared.refundId}`,
      issueType: 'provider_refund_unknown',
      severity: 'critical',
      referenceType: 'Refund',
      referenceId: prepared.refundId,
      details: { message: error.message },
    }).catch(() => null)
    throw new AppError('Chưa xác định được kết quả hoàn tiền VNPay; cần đối soát', HTTP_STATUS.SERVICE_UNAVAILABLE, 'VNPAY_REFUND_UNKNOWN')
  }

  if (providerResult.vnp_ResponseCode !== '00') {
    await runRequiredMongoTransaction(async (session) => {
      const refund = await Refund.findOne({ _id: prepared.refundId, status: REFUND_STATUS.PROCESSING }).session(session)
      if (!refund) return
      const order = await Order.findById(refund.order).session(session)
      await postBalancedTransaction({
        commandKey: `refund_reserve_reversal:${refund._id}`,
        transactionType: 'refund_reserve_reversal',
        referenceType: 'Refund',
        referenceId: refund._id,
        entries: [
          { account: accountDefinitions.refundPayable(refund._id), direction: 'debit', amount: refund.amount },
          { account: accountDefinitions.orderEscrow(order.checkout), direction: 'credit', amount: refund.amount },
        ],
      }, session)
      refund.status = REFUND_STATUS.FAILED
      refund.failureReason = providerResult.vnp_Message || providerResult.vnp_ResponseCode
      await refund.save({ session })
    })
    await ReconciliationIssue.create({
      issueKey: `vnpay-refund-rejected:${prepared.refundId}`,
      issueType: 'provider_refund_rejected',
      severity: 'high',
      referenceType: 'Refund',
      referenceId: prepared.refundId,
      details: providerResult,
    }).catch(() => null)
    throw new AppError('VNPay từ chối yêu cầu hoàn tiền', HTTP_STATUS.CONFLICT, 'VNPAY_REFUND_REJECTED')
  }

  return runRequiredMongoTransaction(async (session) => {
    const refund = await Refund.findOne({ _id: prepared.refundId, status: REFUND_STATUS.PROCESSING }).session(session)
    if (!refund) return Refund.findById(prepared.refundId).session(session)
    await postBalancedTransaction({
      commandKey: `refund_provider_complete:${refund._id}`,
      transactionType: 'provider_refund',
      referenceType: 'Refund',
      referenceId: refund._id,
      entries: [
        { account: accountDefinitions.refundPayable(refund._id), direction: 'debit', amount: refund.amount },
        { account: accountDefinitions.providerClearing('vnpay'), direction: 'credit', amount: refund.amount },
      ],
    }, session)
    refund.status = REFUND_STATUS.SUCCEEDED
    refund.providerReference = providerResult.vnp_TransactionNo || providerResult.vnp_ResponseId
    refund.evidence = {
      transactionId: providerResult.vnp_TransactionNo || providerResult.vnp_ResponseId || '',
      note: providerResult.vnp_Message || 'VNPay refund accepted',
    }
    refund.processedAt = new Date()
    await refund.save({ session })
    await updateOrderRefundStatus(refund, session)
    return refund
  })
}

export const processRefund = async (refundId, adminId) => {
  const source = await Refund.findById(refundId).select('source').lean()
  if (source?.source === 'vnpay') return processVnpayRefund(refundId, adminId)
  return runRequiredMongoTransaction(async (session) => {
  const refund = await Refund.findOne({ _id: refundId, status: REFUND_STATUS.REQUESTED }).session(session)
  if (!refund) throw new AppError('Yêu cầu hoàn tiền đã được xử lý', HTTP_STATUS.CONFLICT, 'REFUND_NOT_REQUESTED')
  const order = await Order.findById(refund.order).session(session)
  if (refund.source === 'payos') {
    await postBalancedTransaction({
      commandKey: `refund_reserve:${refund._id}`,
      transactionType: 'refund_reserve',
      referenceType: 'Refund',
      referenceId: refund._id,
      entries: [
        { account: accountDefinitions.orderEscrow(order.checkout), direction: 'debit', amount: refund.amount },
        { account: accountDefinitions.refundPayable(refund._id), direction: 'credit', amount: refund.amount },
      ],
    }, session)
    refund.status = REFUND_STATUS.MANUAL_REQUIRED
  } else if (refund.source === 'wallet') {
    await postBalancedTransaction({
      commandKey: `refund_complete:${refund._id}`,
      transactionType: 'wallet_refund',
      referenceType: 'Refund',
      referenceId: refund._id,
      entries: [
        { account: accountDefinitions.orderEscrow(order.checkout), direction: 'debit', amount: refund.amount },
        { account: accountDefinitions.userWallet(refund.buyer), direction: 'credit', amount: refund.amount },
      ],
    }, session)
    await UserWallet.findOneAndUpdate({ user: refund.buyer }, { $inc: { balance: refund.amount } }, { upsert: true, session })
    refund.status = REFUND_STATUS.SUCCEEDED
    refund.processedAt = new Date()
  }
  refund.processedBy = adminId
  await refund.save({ session })
  if (refund.status === REFUND_STATUS.SUCCEEDED) await updateOrderRefundStatus(refund, session)
  return refund
  })
}

export const confirmManualRefund = async ({ refundId, adminId, evidence }) => runRequiredMongoTransaction(async (session) => {
  const refund = await Refund.findOne({ _id: refundId, status: REFUND_STATUS.MANUAL_REQUIRED }).session(session)
  if (!refund) throw new AppError('Yêu cầu không chờ xác nhận thủ công', HTTP_STATUS.CONFLICT, 'REFUND_NOT_MANUAL_REQUIRED')
  await postBalancedTransaction({
    commandKey: `refund_manual_complete:${refund._id}`,
    transactionType: 'manual_provider_refund',
    referenceType: 'Refund',
    referenceId: refund._id,
    entries: [
      { account: accountDefinitions.refundPayable(refund._id), direction: 'debit', amount: refund.amount },
      { account: accountDefinitions.providerClearing(refund.source), direction: 'credit', amount: refund.amount },
    ],
  }, session)
  refund.status = REFUND_STATUS.SUCCEEDED
  refund.evidence = evidence
  refund.processedBy = adminId
  refund.processedAt = new Date()
  await refund.save({ session })
  await updateOrderRefundStatus(refund, session)
  return refund
})

export const listReconciliationIssues = async () => {
  return ReconciliationIssue.find({ status: 'open' }).sort({ createdAt: -1 }).limit(200)
}
