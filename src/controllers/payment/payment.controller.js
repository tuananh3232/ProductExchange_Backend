import * as paymentService from '../../services/payment/payment.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createVnpayPayment = async (req, res, next) => {
  try {
    const result = await paymentService.createVnpayPayment(req.body.orderId, req.user, req)
    sendSuccess(res, {
      message: MESSAGES.PAYMENT.CREATED,
      data: result,
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const vnpayReturn = async (req, res, next) => {
  try {
    const result = await paymentService.buildReturnResponse(req.query)
    sendSuccess(res, {
      message: MESSAGES.PAYMENT.CALLBACK_PROCESSED,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

export const vnpayIpn = async (req, res, next) => {
  try {
    const result = await paymentService.handleVnpayCallback(req.body && Object.keys(req.body).length ? req.body : req.query)
    res.status(200).json({ RspCode: '00', Message: 'Confirm Success', data: result })
  } catch (error) {
    next(error)
  }
}
