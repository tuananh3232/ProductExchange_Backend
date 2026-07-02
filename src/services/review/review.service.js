import * as reviewRepo from '../../repositories/review/review.repository.js'
import * as orderRepo from '../../repositories/order/order.repository.js'
import * as productRepo from '../../repositories/product/product.repository.js'
import * as shopRepo from '../../repositories/shop/shop.repository.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { ORDER_STATUS } from '../../constants/status.constant.js'
import { ROLES } from '../../constants/role.constant.js'
import { paginate } from '../../utils/pagination.util.js'
import { uploadBuffer, deleteImage } from '../../utils/cloudinary.util.js'

const idString = (value) => {
  if (!value) return null
  if (typeof value === 'object' && value._id) return String(value._id)
  return String(value)
}

const isAdmin = (userContext) => (userContext?.roles || []).includes(ROLES.ADMIN)

const uploadReviewImages = async (files = []) =>
  files.length ? Promise.all(files.map((file) => uploadBuffer(file.buffer, 'reviews'))).then((images) => images.map((image) => ({ url: image.url, publicId: image.publicId }))) : []

const recalcProductRating = async (productId) => {
  const summary = await reviewRepo.aggregateProductRating(productId)
  await productRepo.updateById(productId, { rating: { average: summary.average, count: summary.count } })
  return summary
}

export const createReview = async (userId, payload, files = []) => {
  const { orderId, productId, rating, comment } = payload

  const order = await orderRepo.findById(orderId)
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  if (idString(order.buyer) !== String(userId)) {
    throw new AppError('Bạn chỉ có thể đánh giá đơn hàng của chính mình', HTTP_STATUS.FORBIDDEN, ERRORS.REVIEW.NOT_BUYER)
  }

  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Đơn hàng phải được giao thành công trước khi đánh giá', HTTP_STATUS.BAD_REQUEST, ERRORS.REVIEW.ORDER_NOT_DELIVERED)
  }

  if (idString(order.product) !== String(productId)) {
    throw new AppError('Sản phẩm không thuộc đơn hàng này', HTTP_STATUS.BAD_REQUEST, ERRORS.REVIEW.ORDER_PRODUCT_MISMATCH)
  }

  const existed = await reviewRepo.findByOrderAndProduct(orderId, productId)
  if (existed) {
    throw new AppError('Bạn đã đánh giá đơn hàng này rồi', HTTP_STATUS.CONFLICT, ERRORS.REVIEW.ALREADY_REVIEWED)
  }

  const images = await uploadReviewImages(files)

  const review = await reviewRepo.create({
    product: productId,
    order: orderId,
    reviewer: userId,
    shop: idString(order.shop),
    seller: idString(order.seller),
    rating,
    comment: comment || '',
    images,
  })

  await recalcProductRating(productId)

  return review
}

export const getProductReviews = async (productId, query, pagination) => {
  const filter = { product: productId, isActive: true }
  if (query.rating) filter.rating = Number(query.rating)
  if (query.hasImage === true || query.hasImage === 'true') filter['images.0'] = { $exists: true }

  const { items: reviews, meta } = await paginate(reviewRepo, filter, pagination)
  const summary = await reviewRepo.aggregateProductRating(productId)

  return { reviews, summary, meta }
}

export const updateReview = async (userId, reviewId, payload, files = []) => {
  const review = await reviewRepo.findById(reviewId)
  if (!review || !review.isActive) {
    throw new AppError('Không tìm thấy đánh giá', HTTP_STATUS.NOT_FOUND, ERRORS.REVIEW.NOT_FOUND)
  }

  if (idString(review.reviewer) !== String(userId)) {
    throw new AppError('Bạn không phải chủ của đánh giá này', HTTP_STATUS.FORBIDDEN, ERRORS.REVIEW.NOT_REVIEW_OWNER)
  }

  const updateData = {}
  if (payload.rating !== undefined) updateData.rating = payload.rating
  if (payload.comment !== undefined) updateData.comment = payload.comment

  if (files.length) {
    const oldImages = review.images || []
    updateData.images = await uploadReviewImages(files)
    await Promise.all(oldImages.map((image) => deleteImage(image.publicId)))
  }

  const updated = await reviewRepo.updateById(reviewId, updateData)
  await recalcProductRating(idString(review.product))

  return updated
}

export const deleteReview = async (userContext, reviewId) => {
  const review = await reviewRepo.findById(reviewId)
  if (!review || !review.isActive) {
    throw new AppError('Không tìm thấy đánh giá', HTTP_STATUS.NOT_FOUND, ERRORS.REVIEW.NOT_FOUND)
  }

  if (!isAdmin(userContext) && idString(review.reviewer) !== String(userContext._id)) {
    throw new AppError('Bạn không phải chủ của đánh giá này', HTTP_STATUS.FORBIDDEN, ERRORS.REVIEW.NOT_REVIEW_OWNER)
  }

  await reviewRepo.updateById(reviewId, { isActive: false })
  await recalcProductRating(idString(review.product))
}

const canReplyReview = async (userContext, review) => {
  if (isAdmin(userContext)) return true

  const userId = String(userContext._id)

  if (review.seller && idString(review.seller) === userId) return true

  if (review.shop) {
    const shop = await shopRepo.findById(idString(review.shop))
    if (!shop) return false
    if (idString(shop.owner) === userId) return true
    return (shop.staff || []).some((staff) => idString(staff) === userId)
  }

  return false
}

export const replyReview = async (userContext, reviewId, content) => {
  const review = await reviewRepo.findById(reviewId)
  if (!review || !review.isActive) {
    throw new AppError('Không tìm thấy đánh giá', HTTP_STATUS.NOT_FOUND, ERRORS.REVIEW.NOT_FOUND)
  }

  const allowed = await canReplyReview(userContext, review)
  if (!allowed) {
    throw new AppError('Bạn không có quyền phản hồi đánh giá này', HTTP_STATUS.FORBIDDEN, ERRORS.REVIEW.CANNOT_REPLY)
  }

  return reviewRepo.updateById(reviewId, {
    reply: { content, repliedBy: userContext._id, repliedAt: new Date() },
  })
}
