import * as orderService from '../../services/order/order.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.user._id, req.body)
  sendSuccess(res, {
    message: MESSAGES.ORDER.CREATED,
    data: { order },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.ORDER.DETAIL_FETCHED, data: { order } })
})

export const getOrders = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { orders, meta } = await orderService.getOrders(req.user, req.query, pagination)
  sendSuccess(res, { message: MESSAGES.ORDER.FETCHED, data: { orders }, meta })
})

export const confirmOrder = asyncHandler(async (req, res) => {
  const order = await orderService.confirmOrder(req.params.id, req.user)
  sendSuccess(res, { message: MESSAGES.ORDER.CONFIRMED, data: { order } })
})

export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.params.id, req.user, req.body.note)
  sendSuccess(res, { message: MESSAGES.ORDER.CANCELLED, data: { order } })
})

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.user, req.body.status, req.body.note)
  sendSuccess(res, { message: MESSAGES.ORDER.STATUS_UPDATED, data: { order } })
})
