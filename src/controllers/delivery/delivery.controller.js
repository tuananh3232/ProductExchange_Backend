import * as deliveryService from '../../services/delivery/delivery.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const assignDelivery = async (req, res, next) => {
  try {
    const delivery = await deliveryService.assignDelivery(req.body, req.user)
    sendSuccess(res, {
      message: MESSAGES.DELIVERY.ASSIGNED,
      data: { delivery },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const getMyDeliveries = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { deliveries, meta } = await deliveryService.getMyDeliveries(req.user, req.query, pagination)
    sendSuccess(res, { message: MESSAGES.DELIVERY.FETCHED, data: { deliveries }, meta })
  } catch (error) {
    next(error)
  }
}

export const getDeliveryById = async (req, res, next) => {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.DELIVERY.DETAIL_FETCHED, data: { delivery } })
  } catch (error) {
    next(error)
  }
}

export const acceptDelivery = async (req, res, next) => {
  try {
    const delivery = await deliveryService.acceptDelivery(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.DELIVERY.ACCEPTED, data: { delivery } })
  } catch (error) {
    next(error)
  }
}

export const pickupOrder = async (req, res, next) => {
  try {
    const delivery = await deliveryService.pickupOrder(req.params.id, req.user, req.body.note)
    sendSuccess(res, { message: MESSAGES.DELIVERY.PICKED_UP, data: { delivery } })
  } catch (error) {
    next(error)
  }
}

export const updateDeliveryStatus = async (req, res, next) => {
  try {
    const delivery = await deliveryService.updateDeliveryStatus(req.params.id, req.user, req.body.status, req.body.note)
    sendSuccess(res, { message: MESSAGES.DELIVERY.STATUS_UPDATED, data: { delivery } })
  } catch (error) {
    next(error)
  }
}

export const completeDelivery = async (req, res, next) => {
  try {
    const delivery = await deliveryService.completeDelivery(req.params.id, req.user, req.body.note)
    sendSuccess(res, { message: MESSAGES.DELIVERY.COMPLETED, data: { delivery } })
  } catch (error) {
    next(error)
  }
}
