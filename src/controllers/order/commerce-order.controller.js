import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as service from '../../services/order/commerce-order.service.js'

export const list = asyncHandler(async (req, res) => {
  const orders = await service.listBuyerOrders(req.user._id)
  sendSuccess(res, { message: 'Lấy danh sách đơn hàng thành công', data: { orders } })
})

export const detail = asyncHandler(async (req, res) => {
  const order = await service.getBuyerOrder(req.params.orderId, req.user._id)
  sendSuccess(res, { message: 'Lấy đơn hàng thành công', data: { order } })
})

const action = (serviceAction, message) => asyncHandler(async (req, res) => {
  const order = await serviceAction(req.params.orderId, req.user._id)
  sendSuccess(res, { message, data: { order } })
})

export const confirm = action(service.confirmOrder, 'Đã xác nhận đơn hàng')
export const process = action(service.processOrder, 'Đơn hàng đang được xử lý')
export const delivered = action(service.markDelivered, 'Đã ghi nhận giao hàng thành công')
export const confirmReceived = action(service.confirmReceived, 'Đã xác nhận nhận hàng')
export const cancel = action(service.cancelOrder, 'Đã hủy đơn hàng')

export const ship = asyncHandler(async (req, res) => {
  const order = await service.shipOrder({ orderId: req.params.orderId, userId: req.user._id, ...req.body })
  sendSuccess(res, { message: 'Đã cập nhật thông tin giao hàng', data: { order } })
})
