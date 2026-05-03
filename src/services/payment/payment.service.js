import crypto from 'crypto'
import Order from '../../models/order.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../../constants/status.constant.js'
import { env } from '../../configs/env.config.js'
import * as paymentRepo from '../../repositories/payment/payment.repository.js'

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  '127.0.0.1'

const isBuyerOrAdmin = (order, userContext) => {
  const userId = userContext?._id?.toString()
  if (!userId) return false

  if ((userContext?.roles || []).includes('admin')) return true

  return order.buyer?._id?.toString() === userId || order.buyer?.toString() === userId
}

const buildSortQuery = (params) =>
  [...params.entries()]
    .filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .map(([key, value]) => [key, value])
    .sort(([a], [b]) => a.localeCompare(b))

const buildQueryString = (params) =>
  buildSortQuery(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

const signVnpayParams = (params) => {
  const sortedQuery = buildQueryString(params)
  return crypto.createHmac('sha512', env.payment.vnpay.hashSecret).update(Buffer.from(sortedQuery, 'utf-8')).digest('hex')
}

const createPaymentUrl = (params) => {
  const signedParams = new URLSearchParams(params)
  const secureHash = signVnpayParams(signedParams)
  signedParams.append('vnp_SecureHashType', 'HmacSHA512')
  signedParams.append('vnp_SecureHash', secureHash)
  return `${env.payment.vnpay.paymentUrl}?${signedParams.toString()}`
}

const normalizeCallbackPayload = (payload) => {
  const normalized = {}
  for (const [key, value] of Object.entries(payload || {})) {
    normalized[key] = Array.isArray(value) ? value[0] : value
  }
  return normalized
}

const verifyVnpaySignature = (payload) => {
  const normalized = normalizeCallbackPayload(payload)
  const query = new URLSearchParams(normalized)
  const secureHash = query.get('vnp_SecureHash')
  if (!secureHash) return false

  const expectedHash = signVnpayParams(query)
  return expectedHash === secureHash
}

const resolvePaymentStatus = (responseCode, transactionStatus) => {
  if (responseCode === '00' && transactionStatus === '00') return PAYMENT_STATUS.PAID
  if (responseCode === '24') return PAYMENT_STATUS.CANCELLED
  return PAYMENT_STATUS.FAILED
}

export const createVnpayPayment = async (orderId, userContext, req) => {
  const order = await Order.findById(orderId).populate('buyer', 'name email')
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  if (!isBuyerOrAdmin(order, userContext)) {
    throw new AppError('Bạn không có quyền thanh toán đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Đơn hàng chưa đủ điều kiện để thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ORDER_NOT_ELIGIBLE)
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng đã được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ALREADY_PAID)
  }

  const existingPayment = await paymentRepo.findByOrder(order._id)
  const transactionRef = existingPayment?.transactionRef || `ORD${order._id.toString()}_${Date.now()}`
  const amount = Number(order.totalAmount)
  const createDate = new Date()
  const expireDate = new Date(Date.now() + 15 * 60 * 1000)

  const paymentPayload = {
    order: order._id,
    buyer: order.buyer._id || order.buyer,
    amount,
    provider: 'vnpay',
    method: 'vnpay',
    status: PAYMENT_STATUS.PENDING_PAYMENT,
    transactionRef,
  }

  const payment = existingPayment
    ? await paymentRepo.updateById(existingPayment._id, paymentPayload)
    : await paymentRepo.create(paymentPayload)

  await Order.findByIdAndUpdate(order._id, {
    paymentStatus: PAYMENT_STATUS.PENDING_PAYMENT,
    paymentMethod: 'vnpay',
    paymentProvider: 'vnpay',
    paymentRef: transactionRef,
  })

  const params = new URLSearchParams({
    vnp_Version: env.payment.vnpay.version,
    vnp_Command: env.payment.vnpay.command,
    vnp_TmnCode: env.payment.vnpay.tmnCode,
    vnp_Amount: `${Math.round(amount * 100)}`,
    vnp_CurrCode: env.payment.vnpay.currCode,
    vnp_TxnRef: transactionRef,
    vnp_OrderInfo: `Thanh toan don hang ${order._id.toString()}`,
    vnp_OrderType: env.payment.vnpay.orderType,
    vnp_Locale: env.payment.vnpay.locale,
    vnp_ReturnUrl: env.payment.vnpay.returnUrl,
    vnp_IpAddr: getClientIp(req),
    vnp_CreateDate: createDate.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
    vnp_ExpireDate: expireDate.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14),
  })

  return {
    payment,
    paymentUrl: createPaymentUrl(params),
  }
}

export const handleVnpayCallback = async (callbackPayload) => {
  const payload = normalizeCallbackPayload(callbackPayload)
  if (!verifyVnpaySignature(payload)) {
    throw new AppError('Chữ ký VNPay không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.INVALID_SIGNATURE)
  }

  const transactionRef = payload.vnp_TxnRef
  const payment = await paymentRepo.findByTransactionRef(transactionRef)
  if (!payment) {
    throw new AppError('Không tìm thấy giao dịch thanh toán', HTTP_STATUS.NOT_FOUND, ERRORS.PAYMENT.NOT_FOUND)
  }

  const amount = Number(payload.vnp_Amount || 0) / 100
  if (amount !== Number(payment.amount)) {
    throw new AppError('Số tiền thanh toán không khớp', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.AMOUNT_MISMATCH)
  }

  const nextStatus = resolvePaymentStatus(payload.vnp_ResponseCode, payload.vnp_TransactionStatus)

  const updatedPayment = await paymentRepo.updateById(payment._id, {
    status: nextStatus,
    responseCode: payload.vnp_ResponseCode || '',
    bankCode: payload.vnp_BankCode || '',
    vnpTransactionNo: payload.vnp_TransactionNo || '',
    rawCallbackData: payload,
    paidAt: nextStatus === PAYMENT_STATUS.PAID ? new Date() : null,
  })

  const orderUpdate = {
    paymentStatus: nextStatus,
    paymentMethod: 'vnpay',
    paymentProvider: 'vnpay',
    paymentRef: transactionRef,
  }

  if (nextStatus === PAYMENT_STATUS.PAID) {
    orderUpdate.paidAt = new Date()
  }

  await Order.findByIdAndUpdate(payment.order, orderUpdate)

  return { payment: updatedPayment, orderId: payment.order, status: nextStatus }
}

export const buildReturnResponse = async (query) => {
  const result = await handleVnpayCallback(query)
  return result
}
