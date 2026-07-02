import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import * as exchangeService from '../../services/exchange/exchange.service.js'

export const getAdminExchangeOffers = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const result = await exchangeService.getAdminExchangeOffers(req.query, pagination)

  sendSuccess(res, {
    message: 'Lấy danh sách giao dịch trao đổi thành công',
    data: { exchangeOffers: result.exchangeOffers },
    meta: result.meta,
  })
})

export const getAdminExchangeOfferById = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.getAdminExchangeOfferById(req.params.exchangeOfferId)

  sendSuccess(res, {
    message: 'Lấy chi tiết giao dịch trao đổi thành công',
    data: { exchangeOffer },
  })
})

export const resolveAdminExchangeDispute = asyncHandler(async (req, res) => {
  const exchangeOffer = await exchangeService.resolveAdminExchangeDispute(req.params.exchangeOfferId, req.body, req.user)

  sendSuccess(res, {
    message: 'Xử lý tranh chấp trao đổi thành công',
    data: { exchangeOffer },
  })
})
