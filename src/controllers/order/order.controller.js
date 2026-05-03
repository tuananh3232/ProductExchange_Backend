import * as orderService from '../../services/order/order.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user._id, req.body)
    sendSuccess(res, {
      message: MESSAGES.ORDER.CREATED,
      data: { order },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.ORDER.DETAIL_FETCHED, data: { order } })
  } catch (error) {
    next(error)
  }
}

export const getOrders = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { orders, meta } = await orderService.getOrders(req.user, req.query, pagination)
    sendSuccess(res, { message: MESSAGES.ORDER.FETCHED, data: { orders }, meta })
  } catch (error) {
    next(error)
  }
}

export const confirmOrder = async (req, res, next) => {
  try {
    const order = await orderService.confirmOrder(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.ORDER.CONFIRMED, data: { order } })
  } catch (error) {
    next(error)
  }
}

export const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user, req.body.note)
    sendSuccess(res, { message: MESSAGES.ORDER.CANCELLED, data: { order } })
  } catch (error) {
    next(error)
  }
}

export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.user, req.body.status, req.body.note)
    sendSuccess(res, { message: MESSAGES.ORDER.STATUS_UPDATED, data: { order } })
  } catch (error) {
    next(error)
  }
}
