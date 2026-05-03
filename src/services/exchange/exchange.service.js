import Exchange from '../../models/exchange.model.js'
import Product from '../../models/product.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { assertDataScope, isAdmin } from '../../utils/data-scope.util.js'
import { PRODUCT_STATUS, EXCHANGE_STATUS } from '../../constants/status.constant.js'

const appendHistory = (history = [], status, updatedBy, note = '') => [
  ...history,
  {
    status,
    note,
    updatedBy,
    updatedAt: new Date(),
  },
]

const isProductReadyForExchange = (product) =>
  product && product.isActive && product.status === PRODUCT_STATUS.AVAILABLE

export const createExchange = async (requesterId, { requestedProduct: reqProdId, offeredProduct: offProdId, message }) => {
  const [reqProd, offProd] = await Promise.all([
    Product.findById(reqProdId),
    Product.findById(offProdId),
  ])

  if (!isProductReadyForExchange(reqProd)) {
    throw new AppError('Sản phẩm yêu cầu không còn khả dụng', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.UNAVAILABLE)
  }

  if (!isProductReadyForExchange(offProd)) {
    throw new AppError('Sản phẩm đề xuất không còn khả dụng', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.OFFERED_NOT_AVAILABLE)
  }

  // Không trao đổi sản phẩm của chính mình
  if (reqProd.owner.toString() === requesterId.toString()) {
    throw new AppError('Không thể trao đổi sản phẩm của chính bạn', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.CANNOT_EXCHANGE_OWN)
  }

  // Kiểm tra sản phẩm mình đưa ra phải là của mình
  if (offProd.owner.toString() !== requesterId.toString()) {
    throw new AppError('Sản phẩm đề xuất không phải của bạn', HTTP_STATUS.FORBIDDEN, ERRORS.PRODUCT.NOT_OWNER)
  }

  // Kiểm tra đã có đề xuất pending chưa
  const existing = await Exchange.findOne({
    requester: requesterId,
    requestedProduct: reqProdId,
    status: 'pending',
  })
  if (existing) {
    throw new AppError('Bạn đã gửi đề xuất cho sản phẩm này rồi', HTTP_STATUS.CONFLICT, ERRORS.EXCHANGE.DUPLICATE_REQUEST)
  }

  const exchange = await Exchange.create({
    requester: requesterId,
    receiver: reqProd.owner,
    requestedProduct: reqProdId,
    offeredProduct: offProdId,
    message,
    history: [
      {
        status: EXCHANGE_STATUS.PENDING,
        note: 'Tạo đề xuất trao đổi',
        updatedBy: requesterId,
        updatedAt: new Date(),
      },
    ],
  })

  return exchange.populate([
    { path: 'requester', select: 'name avatar' },
    { path: 'requestedProduct', select: 'title images price' },
    { path: 'offeredProduct', select: 'title images price' },
  ])
}

export const getExchanges = async (userId, query, { page, limit, skip }) => {
  // Lấy các đề xuất liên quan đến user (là người gửi hoặc người nhận)
  const filter = {
    $or: [{ requester: userId }, { receiver: userId }],
  }
  if (query.status) filter.status = query.status
  if (query.role === 'requester') { delete filter.$or; filter.requester = userId }
  if (query.role === 'receiver') { delete filter.$or; filter.receiver = userId }

  const [exchanges, total] = await Promise.all([
    Exchange.find(filter)
      .populate('requester', 'name avatar')
      .populate('receiver', 'name avatar')
      .populate('requestedProduct', 'title images price')
      .populate('offeredProduct', 'title images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Exchange.countDocuments(filter),
  ])

  return { exchanges, meta: buildPaginationMeta(total, page, limit) }
}

export const getExchangeById = async (id, userContext) => {
  const exchange = await Exchange.findById(id)
      .populate('requester', 'name avatar')
      .populate('receiver', 'name avatar')
      .populate('requestedProduct', 'title images price owner shop')
      .populate('offeredProduct', 'title images price owner shop')
  
  if (!exchange) {
    throw new AppError('Không tìm thấy đề xuất trao đổi', HTTP_STATUS.NOT_FOUND, ERRORS.EXCHANGE.NOT_FOUND)
  }

  const isRelatedParty = [exchange.requester?._id, exchange.receiver?._id]
    .filter(Boolean)
    .some((idValue) => idValue.toString() === userContext?._id?.toString())

  if (!isRelatedParty && !isAdmin(userContext)) {
    const candidateOwnerId = exchange.requestedProduct?.owner || exchange.offeredProduct?.owner
    const candidateShopId = exchange.requestedProduct?.shop || exchange.offeredProduct?.shop

    assertDataScope({
      user: userContext,
      ownerId: candidateOwnerId,
      shopId: candidateShopId,
      deliveryAssigneeId: exchange.deliveryAssignee,
      message: 'Bạn không có quyền xem đề xuất trao đổi này',
      errorCode: ERRORS.EXCHANGE.NOT_AUTHORIZED,
    })
  }

  return exchange
}

export const respondToExchange = async (exchangeId, receiverId, { action, rejectionReason }) => {
  const exchange = await Exchange.findById(exchangeId)
  if (!exchange) {
    throw new AppError('Không tìm thấy đề xuất trao đổi', HTTP_STATUS.NOT_FOUND, ERRORS.EXCHANGE.NOT_FOUND)
  }

  if (exchange.receiver.toString() !== receiverId.toString()) {
    throw new AppError('Bạn không có quyền phản hồi đề xuất này', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.NOT_AUTHORIZED)
  }

  if (exchange.status !== 'pending') {
    throw new AppError('Đề xuất này đã được phản hồi trước đó', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.ALREADY_RESPONDED)
  }

  exchange.status = action === 'accept' ? 'accepted' : 'rejected'
  exchange.rejectionReason = rejectionReason || ''
  exchange.respondedAt = new Date()
  exchange.history = appendHistory(
    exchange.history,
    exchange.status,
    receiverId,
    action === 'accept' ? 'Chấp nhận đề xuất trao đổi' : rejectionReason || 'Từ chối đề xuất trao đổi'
  )
  await exchange.save()

  // Nếu chấp nhận, đánh dấu cả 2 sản phẩm là "pending"
  if (action === 'accept') {
    await Promise.all([
      Product.findByIdAndUpdate(exchange.requestedProduct, { status: PRODUCT_STATUS.PENDING }),
      Product.findByIdAndUpdate(exchange.offeredProduct, { status: PRODUCT_STATUS.PENDING }),
    ])
  }

  return exchange
}

export const completeExchange = async (exchangeId, userId) => {
  const exchange = await Exchange.findById(exchangeId)
  if (!exchange || exchange.status !== 'accepted') {
    throw new AppError('Đề xuất không tồn tại hoặc chưa được chấp nhận', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.NOT_FOUND)
  }

  const isParty = [exchange.requester.toString(), exchange.receiver.toString()].includes(userId.toString())
  if (!isParty) {
    throw new AppError('Bạn không có quyền xác nhận trao đổi này', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.NOT_AUTHORIZED)
  }

  exchange.status = 'completed'
  exchange.completedAt = new Date()
  exchange.history = appendHistory(exchange.history, exchange.status, userId, 'Hoàn tất trao đổi')
  await exchange.save()

  // Đánh dấu cả 2 sản phẩm là đã trao đổi
  await Promise.all([
    Product.findByIdAndUpdate(exchange.requestedProduct, { status: PRODUCT_STATUS.EXCHANGED }),
    Product.findByIdAndUpdate(exchange.offeredProduct, { status: PRODUCT_STATUS.EXCHANGED }),
  ])

  return exchange
}

export const cancelExchange = async (exchangeId, requesterId) => {
  const exchange = await Exchange.findById(exchangeId)
  if (!exchange) {
    throw new AppError('Không tìm thấy đề xuất trao đổi', HTTP_STATUS.NOT_FOUND, ERRORS.EXCHANGE.NOT_FOUND)
  }
  if (exchange.requester.toString() !== requesterId.toString()) {
    throw new AppError('Bạn không có quyền hủy đề xuất này', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.NOT_AUTHORIZED)
  }
  if (exchange.status !== 'pending') {
    throw new AppError('Chỉ có thể hủy đề xuất đang chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.ALREADY_RESPONDED)
  }

  exchange.status = 'cancelled'
  exchange.history = appendHistory(exchange.history, exchange.status, requesterId, 'Hủy đề xuất trao đổi')
  await exchange.save()
  return exchange
}
