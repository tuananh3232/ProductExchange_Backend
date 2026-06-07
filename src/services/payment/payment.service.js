import crypto from 'crypto'
import { PayOS } from '@payos/node'
import Order from '../../models/order.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS, TOPUP_STATUS } from '../../constants/status.constant.js'
import { USER_WALLET_CONSTANTS } from '../../constants/wallet.constant.js'
import { env } from '../../configs/env.config.js'
import * as paymentRepo from '../../repositories/payment/payment.repository.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'
import * as userWalletService from '../user-wallet/user-wallet.service.js'
import { cancelOrderAndRestoreProducts } from '../order/order.service.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const getPayosClient = () => {
  const { clientId, apiKey, checksumKey } = env.payment.payos
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError('PayOS chưa được cấu hình', HTTP_STATUS.INTERNAL_SERVER_ERROR, ERRORS.PAYMENT.PAYOS_NOT_CONFIGURED)
  }
  return new PayOS({ clientId, apiKey, checksumKey })
}

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

const notifyPaymentResult = (payment, status) => {
  if (![PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED].includes(status)) return null
  return notifySafely({
    recipient: payment.buyer,
    type: status === PAYMENT_STATUS.PAID ? NOTIFICATION_TYPES.PAYMENT_SUCCESS : NOTIFICATION_TYPES.PAYMENT_FAILED,
    title: status === PAYMENT_STATUS.PAID ? 'Thanh toán thành công' : 'Thanh toán thất bại',
    message: status === PAYMENT_STATUS.PAID ? 'Đơn hàng của bạn đã được thanh toán' : 'Thanh toán đơn hàng không thành công',
    targetType: NOTIFICATION_TARGET_TYPES.PAYMENT,
    targetId: payment._id,
    actionUrl: `/orders/${payment.order}`,
    data: { orderId: payment.order, paymentId: payment._id },
  })
}

export const createVnpayPayment = async (orderId, userContext, req) => {
  const order = await Order.findById(orderId).populate('buyer', 'name email')
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  if (!isBuyerOrAdmin(order, userContext)) {
    throw new AppError('Bạn không có quyền thanh toán đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    throw new AppError('Chỉ có thể thanh toán đơn hàng ở trạng thái chờ xác nhận', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ORDER_NOT_ELIGIBLE)
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
    vnp_OrderInfo: `Thanh toán đơn hàng ${order._id.toString()}`,
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
  if (payload.vnp_ResponseCode !== '00') {
    await cancelOrderAndRestoreProducts(payment.order, 'VNPay payment cancelled or failed')
  }
  await notifyPaymentResult(updatedPayment, nextStatus)

  return { payment: updatedPayment, orderId: payment.order, status: nextStatus }
}

export const buildReturnResponse = async (query) => {
  const result = await handleVnpayCallback(query)
  return result
}

const validateOrderForPayment = async (orderId, userContext) => {
  const order = await Order.findById(orderId).populate('buyer', 'name email')
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }
  if (!isBuyerOrAdmin(order, userContext)) {
    throw new AppError('Bạn không có quyền thanh toán đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
  if (order.status !== ORDER_STATUS.PENDING) {
    throw new AppError('Chỉ có thể thanh toán đơn hàng ở trạng thái chờ xác nhận', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ORDER_NOT_ELIGIBLE)
  }
  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng đã được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ALREADY_PAID)
  }
  return order
}

export const createPayosPayment = async (orderId, userContext) => {
  const order = await validateOrderForPayment(orderId, userContext)
  const payos = getPayosClient()

  const existingPayment = await paymentRepo.findByOrder(order._id)
  // PayOS orderCode phải là số nguyên dương, tối đa 9 chữ số
  const orderCode = existingPayment?.transactionRef
    ? parseInt(existingPayment.transactionRef.replace('PAYOS_', ''), 10)
    : Date.now() % 1000000000
  const transactionRef = `PAYOS_${orderCode}`
  const amount = Math.round(Number(order.totalAmount))

  const paymentPayload = {
    order: order._id,
    buyer: order.buyer._id || order.buyer,
    amount,
    provider: 'payos',
    method: 'payos',
    status: PAYMENT_STATUS.PENDING_PAYMENT,
    transactionRef,
  }

  const payment = existingPayment
    ? await paymentRepo.updateById(existingPayment._id, paymentPayload)
    : await paymentRepo.create(paymentPayload)

  await Order.findByIdAndUpdate(order._id, {
    paymentStatus: PAYMENT_STATUS.PENDING_PAYMENT,
    paymentMethod: 'payos',
    paymentProvider: 'payos',
    paymentRef: transactionRef,
  })

  // PayOS giới hạn description tối đa 25 ký tự
  const shortId = order._id.toString().slice(-8)
  const paymentLink = await payos.paymentRequests.create({
    orderCode,
    amount,
    description: `Thanh toán #${shortId}`,
    returnUrl: env.payment.payos.returnUrl,
    cancelUrl: env.payment.payos.cancelUrl,
  })

  return { payment, paymentUrl: paymentLink.checkoutUrl }
}

export const handlePayosWebhook = async (webhookData) => {
  const payos = getPayosClient()

  let verifiedData
  try {
    verifiedData = await payos.webhooks.verify(webhookData)
  } catch {
    throw new AppError('Chữ ký PayOS không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.INVALID_SIGNATURE)
  }

  const transactionRef = `PAYOS_${verifiedData.orderCode}`
  const payment = await paymentRepo.findByTransactionRef(transactionRef)
  if (!payment) {
    throw new AppError('Không tìm thấy giao dịch thanh toán', HTTP_STATUS.NOT_FOUND, ERRORS.PAYMENT.NOT_FOUND)
  }

  if (verifiedData.amount !== Number(payment.amount)) {
    throw new AppError('Số tiền thanh toán không khớp', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.AMOUNT_MISMATCH)
  }

  const nextStatus = webhookData.code === '00' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.FAILED

  const updatedPayment = await paymentRepo.updateById(payment._id, {
    status: nextStatus,
    responseCode: webhookData.code || '',
    rawCallbackData: webhookData,
    paidAt: nextStatus === PAYMENT_STATUS.PAID ? new Date() : null,
  })

  const orderUpdate = {
    paymentStatus: nextStatus,
    paymentMethod: 'payos',
    paymentProvider: 'payos',
    paymentRef: transactionRef,
  }

  if (nextStatus === PAYMENT_STATUS.PAID) {
    orderUpdate.paidAt = new Date()
  }

  await Order.findByIdAndUpdate(payment.order, orderUpdate)
  await notifyPaymentResult(updatedPayment, nextStatus)

  return { payment: updatedPayment, orderId: payment.order, status: nextStatus }
}

// ─── Wallet Topup via PayOS ───────────────────────────────────────────────────

export const createWalletTopup = async (amount, userContext) => {
  const userId = userContext._id

  if (amount < USER_WALLET_CONSTANTS.MIN_TOPUP_AMOUNT) {
    throw new AppError(
      `Số tiền nạp tối thiểu là ${USER_WALLET_CONSTANTS.MIN_TOPUP_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.USER_WALLET.TOPUP_AMOUNT_TOO_LOW
    )
  }

  if (amount > USER_WALLET_CONSTANTS.MAX_TOPUP_AMOUNT) {
    throw new AppError(
      `Số tiền nạp tối đa là ${USER_WALLET_CONSTANTS.MAX_TOPUP_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.USER_WALLET.TOPUP_AMOUNT_TOO_HIGH
    )
  }

  const payos = getPayosClient()
  const wallet = await userWalletRepo.findOrCreateByUser(userId)

  // Trả lại phiên nạp tiền đang pending nếu có (tránh tạo trùng)
  const existingPending = await userWalletRepo.findPendingTopupByUser(userId)
  if (existingPending?.checkoutUrl) {
    return { topup: existingPending, paymentUrl: existingPending.checkoutUrl }
  }

  // PayOS orderCode phải là số nguyên dương, tối đa 9 chữ số
  const orderCode = Date.now() % 1000000000
  const transactionRef = `TOPUP_${orderCode}`
  const roundedAmount = Math.round(Number(amount))

  const topup = await userWalletRepo.createTopup({
    user: userId,
    wallet: wallet._id,
    amount: roundedAmount,
    orderCode,
    transactionRef,
    status: TOPUP_STATUS.PENDING,
  })

  // PayOS giới hạn description tối đa 25 ký tự
  const shortId = topup._id.toString().slice(-6)
  const paymentLink = await payos.paymentRequests.create({
    orderCode,
    amount: roundedAmount,
    description: `Nạp ví #${shortId}`,
    returnUrl: env.payment.payos.topupReturnUrl,
    cancelUrl: env.payment.payos.topupCancelUrl,
  })

  const savedTopup = await userWalletRepo.updateTopup(topup._id, { checkoutUrl: paymentLink.checkoutUrl })

  return { topup: savedTopup, paymentUrl: paymentLink.checkoutUrl }
}

export const handleTopupWebhook = async (webhookData) => {
  const payos = getPayosClient()

  let verifiedData
  try {
    verifiedData = await payos.webhooks.verify(webhookData)
  } catch {
    throw new AppError('Chữ ký PayOS không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.INVALID_SIGNATURE)
  }

  const topup = await userWalletRepo.findTopupByOrderCode(verifiedData.orderCode)
  if (!topup) {
    throw new AppError('Không tìm thấy phiên nạp tiền', HTTP_STATUS.NOT_FOUND, ERRORS.USER_WALLET.TOPUP_NOT_FOUND)
  }

  if (topup.status !== TOPUP_STATUS.PENDING) {
    return { topup, status: topup.status }
  }

  const nextStatus = webhookData.code === '00' ? TOPUP_STATUS.COMPLETED : TOPUP_STATUS.FAILED

  const updatedTopup = await userWalletRepo.updateTopup(topup._id, {
    status: nextStatus,
    rawCallbackData: webhookData,
    completedAt: nextStatus === TOPUP_STATUS.COMPLETED ? new Date() : null,
  })

  if (nextStatus === TOPUP_STATUS.COMPLETED) {
    await userWalletService.creditWalletFromTopup(updatedTopup)
  }

  return { topup: updatedTopup, status: nextStatus }
}

export const handleTopupReturn = async (query, callerId = null) => {
  const { orderCode, cancel, code } = query
  if (!orderCode) {
    throw new AppError('Thiếu thông tin callback PayOS', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.TOPUP_NOT_FOUND)
  }

  const topup = await userWalletRepo.findTopupByOrderCode(Number(orderCode))
  if (!topup) {
    throw new AppError('Không tìm thấy phiên nạp tiền', HTTP_STATUS.NOT_FOUND, ERRORS.USER_WALLET.TOPUP_NOT_FOUND)
  }

  if (callerId && topup.user.toString() !== callerId.toString()) {
    throw new AppError('Bạn không có quyền xác minh phiên nạp tiền này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  // Không cập nhật nếu đã xử lý xong (tránh ghi đè kết quả từ webhook)
  if (topup.status !== TOPUP_STATUS.PENDING) {
    return { topupId: topup._id, status: topup.status }
  }

  // Xác minh trực tiếp từ PayOS API thay vì tin vào query params
  let paymentStatus
  try {
    const payos = getPayosClient()
    const paymentInfo = await payos.paymentRequests.get(Number(orderCode))
    paymentStatus = paymentInfo.status // 'PAID' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'PROCESSING'
  } catch {
    // Fallback về query params khi không gọi được PayOS
    const isCancelled = cancel === 'true' || cancel === true
    if (isCancelled) paymentStatus = 'CANCELLED'
    else if (code === '00') paymentStatus = 'PAID'
    else paymentStatus = 'PENDING'
  }

  // Chưa có kết quả cuối → không cập nhật
  if (paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING') {
    return { topupId: topup._id, status: TOPUP_STATUS.PENDING }
  }

  const nextStatus = paymentStatus === 'PAID' ? TOPUP_STATUS.COMPLETED : TOPUP_STATUS.CANCELLED

  const updatedTopup = await userWalletRepo.updateTopup(topup._id, {
    status: nextStatus,
    completedAt: nextStatus === TOPUP_STATUS.COMPLETED ? new Date() : null,
  })

  if (nextStatus === TOPUP_STATUS.COMPLETED) {
    await userWalletService.creditWalletFromTopup(updatedTopup)
  }

  return { topupId: topup._id, status: nextStatus }
}

export const handlePayosReturn = async (query) => {
  const { orderCode, cancel, code } = query
  if (!orderCode) {
    throw new AppError('Thiếu thông tin callback PayOS', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.NOT_FOUND)
  }

  const transactionRef = `PAYOS_${orderCode}`
  const payment = await paymentRepo.findByTransactionRef(transactionRef)
  if (!payment) {
    throw new AppError('Không tìm thấy giao dịch thanh toán', HTTP_STATUS.NOT_FOUND, ERRORS.PAYMENT.NOT_FOUND)
  }

  // Chỉ cập nhật nếu vẫn đang pending (tránh ghi đè kết quả từ webhook)
  if (payment.status === PAYMENT_STATUS.PENDING_PAYMENT) {
    const isCancelled = cancel === 'true' || cancel === true
    const nextStatus = isCancelled
      ? PAYMENT_STATUS.CANCELLED
      : code === '00'
        ? PAYMENT_STATUS.PAID
        : PAYMENT_STATUS.FAILED

    const updatedPayment = await paymentRepo.updateById(payment._id, {
      status: nextStatus,
      responseCode: code || '',
      paidAt: nextStatus === PAYMENT_STATUS.PAID ? new Date() : null,
    })

    const orderUpdate = { paymentStatus: nextStatus }
    if (nextStatus === PAYMENT_STATUS.PAID) orderUpdate.paidAt = new Date()
    await Order.findByIdAndUpdate(payment.order, orderUpdate)
    if (isCancelled || nextStatus === PAYMENT_STATUS.CANCELLED) {
      await cancelOrderAndRestoreProducts(payment.order, 'PayOS payment cancelled')
    }
    await notifyPaymentResult(updatedPayment, nextStatus)

    return { orderId: payment.order, status: nextStatus }
  }

  if (payment.status === PAYMENT_STATUS.CANCELLED) {
    await cancelOrderAndRestoreProducts(payment.order, 'PayOS payment cancelled')
  }

  return { orderId: payment.order, status: payment.status }
}
