import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import * as service from '../../services/payment/payment-attempt.service.js'
import * as legacyPaymentService from '../../services/payment/payment.service.js'

export const create = asyncHandler(async (req, res) => {
  const payment = await service.createPaymentAttempt({
    checkoutId: req.body.checkoutId,
    buyerId: req.user._id,
    provider: req.body.provider,
    idempotencyKey: req.get('idempotency-key'),
    clientIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  })
  sendSuccess(res, { statusCode: HTTP_STATUS.CREATED, message: 'Tạo giao dịch thanh toán thành công', data: { payment } })
})

export const detail = asyncHandler(async (req, res) => {
  const payment = await service.getPaymentAttempt(req.params.paymentId, req.user._id)
  sendSuccess(res, { message: 'Lấy giao dịch thanh toán thành công', data: { payment } })
})

export const payosWebhook = asyncHandler(async (req, res) => {
  const payment = await service.handlePayosWebhook(req.body)
  sendSuccess(res, { message: 'Webhook đã được xử lý', data: { paymentId: payment._id, status: payment.status } })
})

export const payosReturn = asyncHandler(async (req, res) => {
  const result = await service.getPayosReturnResult(req.query.orderCode)
  sendSuccess(res, { message: 'Kết quả điều hướng PayOS', data: { result } })
})

export const payosWebhookCompatible = asyncHandler(async (req, res) => {
  try {
    const payment = await service.handlePayosWebhook(req.body)
    return sendSuccess(res, { message: 'Webhook đã được xử lý', data: { paymentId: payment._id, status: payment.status } })
  } catch (error) {
    if (error.errorCode !== 'PAYMENT_ATTEMPT_NOT_FOUND') throw error
    const result = await legacyPaymentService.handlePayosWebhook(req.body)
    return sendSuccess(res, { message: 'Webhook legacy đã được xử lý', data: result })
  }
})

export const payosReturnCompatible = asyncHandler(async (req, res) => {
  try {
    const result = await service.getPayosReturnResult(req.query.orderCode)
    return sendSuccess(res, { message: 'Kết quả điều hướng PayOS', data: { result } })
  } catch (error) {
    if (error.errorCode !== 'PAYMENT_ATTEMPT_NOT_FOUND') throw error
    const result = await legacyPaymentService.handlePayosReturn(req.query)
    return sendSuccess(res, { message: 'Kết quả điều hướng PayOS', data: result })
  }
})

export const vnpayIpnCompatible = asyncHandler(async (req, res) => {
  const payload = req.body && Object.keys(req.body).length ? req.body : req.query
  try {
    const payment = await service.handleVnpayIpn(payload)
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Success', data: { paymentId: payment._id, status: payment.status } })
  } catch (error) {
    if (error.errorCode !== 'PAYMENT_ATTEMPT_NOT_FOUND') throw error
    const result = await legacyPaymentService.handleVnpayCallback(payload)
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Success', data: result })
  }
})

export const vnpayReturnCompatible = asyncHandler(async (req, res) => {
  try {
    const result = await service.getVnpayReturnResult(req.query)
    return sendSuccess(res, { message: 'Kết quả điều hướng VNPay', data: { result } })
  } catch (error) {
    if (error.errorCode !== 'PAYMENT_ATTEMPT_NOT_FOUND') throw error
    const result = await legacyPaymentService.buildReturnResponse(req.query)
    return sendSuccess(res, { message: 'Kết quả điều hướng VNPay', data: result })
  }
})
