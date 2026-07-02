import * as reviewService from '../../services/review/review.service.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user._id, req.body, req.files || [])
  sendSuccess(res, {
    message: MESSAGES.REVIEW.CREATED,
    data: { review },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getProductReviews = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { reviews, summary, meta } = await reviewService.getProductReviews(req.params.productId, req.query, pagination)
  sendSuccess(res, { message: MESSAGES.REVIEW.FETCHED, data: { reviews, summary }, meta })
})

export const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateReview(req.user._id, req.params.id, req.body, req.files || [])
  sendSuccess(res, { message: MESSAGES.REVIEW.UPDATED, data: { review } })
})

export const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.user, req.params.id)
  sendSuccess(res, { message: MESSAGES.REVIEW.DELETED })
})

export const replyReview = asyncHandler(async (req, res) => {
  const review = await reviewService.replyReview(req.user, req.params.id, req.body.content)
  sendSuccess(res, { message: MESSAGES.REVIEW.REPLIED, data: { review } })
})
