import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as exchangeService from '../../services/exchange/exchange.service.js'

export const listMyExchangeOffers = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await exchangeService.listMyExchangeOffers(req.user, req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách đề nghị trao đổi thành công',
    data: { exchangeOffers: result.exchangeOffers },
    meta: result.meta,
  })
})

export const getMyExchangeOfferById = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.getMyExchangeOfferById(req.params.exchangeOfferId, req.user)

  sendSuccess(res, {
    message: 'Lấy chi tiết đề nghị trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const createExchangeOffer = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.createExchangeOffer(req.body, req.user)

  sendSuccess(res, {
    message: 'Tạo đề nghị trao đổi thành công',
    statusCode: 201,
    data: { exchangeOffer },
  })
})

export const counterExchangeOffer = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.counterExchangeOffer(req.params.exchangeOfferId, req.body, req.user)

  sendSuccess(res, {
    message: 'Counter đề nghị trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const acceptExchangeOffer = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.acceptExchangeOffer(req.params.exchangeOfferId, req.user)

  sendSuccess(res, {
    message: 'Chấp nhận đề nghị trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const payExchangeDifference = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.payExchangeDifference(req.params.exchangeOfferId, req.user)

  sendSuccess(res, {
    message: 'Thanh toán tiền bù trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const markExchangeShipped = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.markExchangeShipped(req.params.exchangeOfferId, req.user)

  sendSuccess(res, {
    message: 'Xác nhận gửi hàng trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const confirmExchangeReceived = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.confirmExchangeReceived(req.params.exchangeOfferId, req.user)

  sendSuccess(res, {
    message: 'Xác nhận nhận hàng trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const cancelExchangeOffer = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.cancelExchangeOffer(req.params.exchangeOfferId, req.body, req.user)

  sendSuccess(res, {
    message: 'Hủy đề nghị trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const openExchangeDispute = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.openExchangeDispute(req.params.exchangeOfferId, req.body, req.user)

  sendSuccess(res, {
    message: 'Mở tranh chấp trao đổi thành công',
    data: { exchangeOffer },
  })
})
