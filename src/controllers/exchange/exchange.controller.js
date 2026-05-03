import * as exchangeService from '../../services/exchange/exchange.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.createExchange(req.user._id, req.body)
    sendSuccess(res, {
      message: MESSAGES.EXCHANGE.CREATED,
      data: { exchange },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (error) {
    next(error)
  }
}

export const getExchanges = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query)
    const { exchanges, meta } = await exchangeService.getExchanges(req.user._id, req.query, pagination)
    sendSuccess(res, { message: MESSAGES.EXCHANGE.FETCHED, data: { exchanges }, meta })
  } catch (error) {
    next(error)
  }
}

export const getExchangeById = async (req, res, next) => {
  try {
    const exchange = await exchangeService.getExchangeById(req.params.id, req.user)
    sendSuccess(res, { message: MESSAGES.EXCHANGE.DETAIL_FETCHED, data: { exchange } })
  } catch (error) {
    next(error)
  }
}

export const respondToExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.respondToExchange(req.params.id, req.user._id, req.body)
    const msg = req.body.action === 'accept' ? MESSAGES.EXCHANGE.ACCEPTED : MESSAGES.EXCHANGE.REJECTED
    sendSuccess(res, { message: msg, data: { exchange } })
  } catch (error) {
    next(error)
  }
}

export const completeExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.completeExchange(req.params.id, req.user._id)
    sendSuccess(res, { message: MESSAGES.EXCHANGE.COMPLETED, data: { exchange } })
  } catch (error) {
    next(error)
  }
}

export const cancelExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.cancelExchange(req.params.id, req.user._id)
    sendSuccess(res, { message: MESSAGES.EXCHANGE.CANCELLED, data: { exchange } })
  } catch (error) {
    next(error)
  }
}
