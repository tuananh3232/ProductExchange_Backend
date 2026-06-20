import Product, { PRODUCT_OWNER_TYPES } from '../../models/product.model.js'
import User from '../../models/user.model.js'
import ExchangeOffer from '../../models/exchange-offer.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { EXCHANGE_STATUS } from '../../constants/status.constant.js'

const LOCKED_EXCHANGE_STATUSES = [
  EXCHANGE_STATUS.PENDING_ACCEPTANCE,
  EXCHANGE_STATUS.ACCEPTED,
  EXCHANGE_STATUS.PAID,
  EXCHANGE_STATUS.SHIPPED,
  EXCHANGE_STATUS.DISPUTED,
]

export const buildExchangeTerms = (requesterProduct, receiverProduct) => {
  const requesterProductValue = Math.round(Number(requesterProduct.price || 0))
  const receiverProductValue = Math.round(Number(receiverProduct.price || 0))
  const cashDifferenceAmount = Math.abs(requesterProductValue - receiverProductValue)

  let cashDifferenceDirection = 'none'
  let cashDifferencePayer = null
  let cashDifferenceReceiver = null

  if (requesterProductValue < receiverProductValue) {
    cashDifferenceDirection = 'requester_to_receiver'
    cashDifferencePayer = requesterProduct.seller
    cashDifferenceReceiver = receiverProduct.seller
  } else if (requesterProductValue > receiverProductValue) {
    cashDifferenceDirection = 'receiver_to_requester'
    cashDifferencePayer = receiverProduct.seller
    cashDifferenceReceiver = requesterProduct.seller
  }

  return {
    requesterProductValue,
    receiverProductValue,
    cashDifferenceAmount,
    cashDifferenceDirection,
    cashDifferencePayer,
    cashDifferenceReceiver,
  }
}

const assertSellerOwnedProduct = (product) => {
  if (!product || !product.isActive || product.status !== 'available') {
    throw new AppError('Sản phẩm không đủ điều kiện trao đổi', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.PRODUCT_NOT_ELIGIBLE)
  }

  if (product.ownerType !== PRODUCT_OWNER_TYPES.SELLER || product.shop) {
    throw new AppError('Shop product không được tham gia trao đổi', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.SHOP_PRODUCT_NOT_ALLOWED)
  }

  if (!product.seller) {
    throw new AppError('Sản phẩm không có seller hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.PRODUCT_NOT_ELIGIBLE)
  }
}

const assertSellerKyc = async (sellerIds) => {
  const sellers = await User.find({ _id: { $in: sellerIds } }).select('_id kyc.status isActive')
  const allApproved = sellers.length === sellerIds.length && sellers.every((seller) => seller.isActive && seller.kyc?.status === 'approved')

  if (!allApproved) {
    throw new AppError('Cả hai seller phải có KYC đã duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.KYC_REQUIRED)
  }
}

const assertNotLockedByExchange = async (productIds, ignoreExchangeId = null) => {
  const filter = {
    isActive: true,
    status: { $in: LOCKED_EXCHANGE_STATUSES },
    $or: [
      { requesterProduct: { $in: productIds } },
      { receiverProduct: { $in: productIds } },
    ],
  }

  if (ignoreExchangeId) {
    filter._id = { $ne: ignoreExchangeId }
  }

  const locked = await ExchangeOffer.exists(filter)
  if (locked) {
    throw new AppError('Một trong hai sản phẩm đang bị khóa bởi giao dịch trao đổi khác', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.PRODUCT_NOT_ELIGIBLE)
  }
}

export const getExchangeEligibility = async ({
  requesterProductId,
  receiverProductId,
  currentUserId,
  ignoreExchangeId = null,
}) => {
  const [requesterProduct, receiverProduct] = await Promise.all([
    Product.findById(requesterProductId).populate('category', 'name slug'),
    Product.findById(receiverProductId).populate('category', 'name slug'),
  ])

  assertSellerOwnedProduct(requesterProduct)
  assertSellerOwnedProduct(receiverProduct)

  if (String(requesterProduct.seller) !== String(currentUserId)) {
    throw new AppError('Bạn không sở hữu sản phẩm dùng để đề xuất trao đổi', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.INVALID_PARTICIPANT)
  }

  if (String(requesterProduct.seller) === String(receiverProduct.seller)) {
    throw new AppError('Không thể trao đổi với sản phẩm của chính mình', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.SELF_EXCHANGE_NOT_ALLOWED)
  }

  await assertSellerKyc([requesterProduct.seller, receiverProduct.seller])
  await assertNotLockedByExchange([requesterProduct._id, receiverProduct._id], ignoreExchangeId)

  return {
    requesterProduct,
    receiverProduct,
    terms: buildExchangeTerms(requesterProduct, receiverProduct),
  }
}
