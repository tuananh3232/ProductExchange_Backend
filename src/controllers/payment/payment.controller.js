import * as paymentService from '../../services/payment/payment.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

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
