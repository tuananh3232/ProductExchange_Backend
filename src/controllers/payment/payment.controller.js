import * as paymentService from '../../services/payment/payment.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { getPaginationParams } from '../../utils/pagination.util.js'

export const getAdminPayments = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { payments, meta } = await paymentService.getAdminPayments(req.query, pagination)
  sendSuccess(res, { message: MESSAGES.PAYMENT.FETCHED || 'Lấy danh sách thanh toán thành công', data: { payments }, meta })
})

export const getAdminPaymentById = asyncHandler(async (req, res) => {
  const result = await paymentService.getAdminPaymentById(req.params.paymentId)
  sendSuccess(res, { message: MESSAGES.PAYMENT.DETAIL_FETCHED || 'Lấy chi tiết thanh toán thành công', data: result })
})

export const updateAdminPaymentStatus = asyncHandler(async (req, res) => {
  const payment = await paymentService.updateAdminPaymentStatus(req.params.paymentId, req.user, req.body)
  sendSuccess(res, { message: MESSAGES.PAYMENT.UPDATED || 'Cập nhật thanh toán thành công', data: { payment } })
})

export const reconcileAdminPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.reconcileAdminPayment(req.params.paymentId, req.user, req.body)
  sendSuccess(res, { message: MESSAGES.PAYMENT.UPDATED || 'Đối soát thanh toán thành công', data: { payment } })
})

export const createVnpayPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.createVnpayPayment(req.body.orderId, req.user, req)
  sendSuccess(res, {
    message: MESSAGES.PAYMENT.CREATED,
    data: result,
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const vnpayReturn = asyncHandler(async (req, res) => {
  const result = await paymentService.buildReturnResponse(req.query)
  sendSuccess(res, { message: MESSAGES.PAYMENT.CALLBACK_PROCESSED, data: result })
})

export const vnpayIpn = asyncHandler(async (req, res) => {
  const result = await paymentService.handleVnpayCallback(
    req.body && Object.keys(req.body).length ? req.body : req.query
  )
  res.status(200).json({ RspCode: '00', Message: 'Confirm Success', data: result })
})

export const createPayosPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.createPayosPayment(req.body.orderId, req.user)
  sendSuccess(res, {
    message: MESSAGES.PAYMENT.CREATED,
    data: result,
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const payosWebhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handlePayosWebhook(req.body)
  res.status(200).json({ code: '00', desc: 'success', data: result })
})

export const payosReturn = asyncHandler(async (req, res) => {
  const result = await paymentService.handlePayosReturn(req.query)
  sendSuccess(res, { message: MESSAGES.PAYMENT.CALLBACK_PROCESSED, data: result })
})

export const topupWebhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handleTopupWebhook(req.body)
  res.status(200).json({ code: '00', desc: 'success', data: result })
})

export const topupReturn = asyncHandler(async (req, res) => {
  const result = await paymentService.handleTopupReturn(req.query)
  sendSuccess(res, { message: MESSAGES.PAYMENT.CALLBACK_PROCESSED, data: result })
})
