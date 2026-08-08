import Product, { PRODUCT_OWNER_TYPES } from '../../models/product.model.js'
import Order from '../../models/order.model.js'
import Shop from '../../models/shop.model.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../../constants/status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import * as orderRepo from '../../repositories/order/order.repository.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import * as walletService from '../wallet/wallet.service.js'
import * as userWalletService from '../user-wallet/user-wallet.service.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'
import { ROLES } from '../../constants/role.constant.js'
import * as paymentRepo from '../../repositories/payment/payment.repository.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import * as ledgerService from '../ledger/ledger.service.js'
import { deleteImage, uploadBuffer } from '../../utils/cloudinary.util.js'

const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

const getOrderSellerRecipient = (order) => order.shop?.owner?._id || order.shop?.owner || order.seller?._id || order.seller

const notifyOrderUser = (recipient, type, order, message, sender = null) => {
  if (!recipient) return null
  return notifySafely({
    recipient,
    sender,
    type,
    title: 'Cập nhật đơn hàng',
    message,
    targetType: NOTIFICATION_TARGET_TYPES.ORDER,
    targetId: order._id,
    actionUrl: `/orders/${order._id}`,
    data: { orderId: order._id },
  })
}

const getManagedShopIds = async (userId) => {
  const shops = await Shop.find({
    isActive: true,
    $or: [{ owner: userId }, { staff: userId }],
  }).select('_id')

  return shops.map((shop) => shop._id.toString())
}

const getPermittedShopIds = async (userId, permissionKey) => {
  const shops = await Shop.find({
    isActive: true,
    $or: [
      { owner: userId },
      {
        staffPermissions: {
          $elemMatch: {
            staffUser: userId,
            permissions: permissionKey,
          },
        },
      },
    ],
  }).select('_id')

  return shops.map((shop) => shop._id.toString())
}

const isAdmin = (userContext) => (userContext?.roles || []).includes('admin')
const isSeller = (userContext) => (userContext?.roles || []).includes(ROLES.SELLER)

const ensureOrderReadable = async (order, userContext) => {
  if (isAdmin(userContext)) return

  const userId = userContext?._id?.toString()
  if (!userId) {
    throw new AppError('Bạn không có quyền xem đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (order.buyer?._id?.toString() === userId || order.buyer?.toString() === userId) {
    return
  }

  const managedShopIds = await getManagedShopIds(userContext._id)
  const orderShopId = order.shop?._id?.toString() || order.shop?.toString()
  if (orderShopId && managedShopIds.includes(orderShopId)) {
    await assertShopPermission({
      user: userContext,
      shopId: orderShopId,
      permissionKey: PERMISSIONS.SHOP_ORDER_READ,
      message: 'Bạn không có quyền xem đơn hàng này',
      errorCode: ERRORS.AUTH.FORBIDDEN,
    })
    return
  }

  const orderSellerId = order.seller?._id?.toString() || order.seller?.toString()
  if (orderSellerId && orderSellerId === userId) {
    return
  }

  throw new AppError('Bạn không có quyền xem đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
}

const ensureShopManageOrder = async (order, userContext, permissionKey) => {
  if (isAdmin(userContext)) return

  const orderShopId = order.shop?._id?.toString() || order.shop?.toString()
  const userId = userContext?._id?.toString()
  const orderSellerId = order.seller?._id?.toString() || order.seller?.toString()
  if (!orderShopId && orderSellerId && orderSellerId === userId && isSeller(userContext)) {
    return
  }

  if (!orderShopId) {
    throw new AppError('Bạn không có quyền xử lý đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.ORDER.NOT_SHOP_ORDER)
  }

  await assertShopPermission({
    user: userContext,
    shopId: orderShopId,
    permissionKey,
    message: 'Bạn không có quyền xử lý đơn hàng này',
    errorCode: ERRORS.ORDER.NOT_SHOP_ORDER,
  })
}

const pushOrderHistory = (order, status, updatedBy, note = '') => {
  order.history = [
    ...(order.history || []),
    {
      status,
      updatedBy,
      note,
      updatedAt: new Date(),
    },
  ]
}

const ensureTransitionAllowed = (currentStatus, nextStatus) => {
  const allowed = ORDER_TRANSITIONS[currentStatus] || []
  if (!allowed.includes(nextStatus)) {
    throw new AppError('Không thể chuyển trạng thái đơn hàng theo vòng đời hiện tại', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
}

export const createOrder = async (buyerId, payload) => {
  const productId = payload.productId || payload.product
  const product = await Product.findById(productId).select('_id owner ownerType shop seller status listingType transactionMode price stock isActive title')
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  if ((product.transactionMode || 'sell') !== 'sell') {
    throw new AppError('Sản phẩm này không hỗ trợ đặt đơn mua', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_NOT_SELLABLE)
  }

  if (product.status !== 'available') {
    throw new AppError('Sản phẩm không còn khả dụng để đặt đơn', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.UNAVAILABLE)
  }

  if (product.owner.toString() === buyerId.toString()) {
    throw new AppError('Không thể tạo đơn cho sản phẩm của chính bạn', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.SELF_ORDER_NOT_ALLOWED)
  }

  if (product.ownerType === PRODUCT_OWNER_TYPES.SHOP && !product.shop) {
    throw new AppError('Sản phẩm chưa gắn với shop', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_MISSING_SHOP)
  }

  if (product.ownerType === PRODUCT_OWNER_TYPES.SELLER && !product.seller) {
    throw new AppError('Sản phẩm chưa gắn với seller', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_MISSING_SHOP)
  }

  const quantity = payload.quantity || 1
  if (product.stock < quantity) {
    throw new AppError('Sản phẩm không còn đủ số lượng yêu cầu', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.UNAVAILABLE)
  }
  const unitPrice = product.price
  const totalAmount = unitPrice * quantity
  // If shippingAddress is not provided or empty, use buyer's profile address
  let shippingAddress = payload.shippingAddress || {}
  const isEmptyAddress = !shippingAddress || (!shippingAddress.province && !shippingAddress.district && !shippingAddress.detail)
  if (isEmptyAddress) {
    const buyer = await User.findById(buyerId).select('address phone')
    if (buyer && buyer.address) shippingAddress = { ...buyer.address.toObject?.() ?? buyer.address, phone: buyer.phone || '' }
  }

  if (!shippingAddress.phone?.trim()) {
    throw new AppError('Vui lòng bổ sung số điện thoại nhận hàng trước khi đặt đơn', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const reservedProduct = await Product.findOneAndUpdate(
    { _id: product._id, isActive: true, status: 'available', stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
  )
  if (!reservedProduct) {
    throw new AppError('Sản phẩm vừa được người khác mua hết', HTTP_STATUS.CONFLICT, ERRORS.PRODUCT.UNAVAILABLE)
  }

  let order
  try {
    order = await orderRepo.create({
    buyer: buyerId,
    shop: product.ownerType === PRODUCT_OWNER_TYPES.SHOP ? product.shop : null,
    seller: product.ownerType === PRODUCT_OWNER_TYPES.SELLER ? product.seller : null,
    product: product._id,
    quantity,
    unitPrice,
    totalAmount,
    grossAmount: totalAmount,
    totalPlatformFee: 0,
    netSettlementAmount: totalAmount,
    settlementStatus: 'pending',
    status: ORDER_STATUS.PENDING,
    shippingAddress,
    note: payload.note || '',
    inventoryStatus: 'reserved',
    history: [
      {
        status: ORDER_STATUS.PENDING,
        note: 'Tạo đơn hàng',
        updatedBy: buyerId,
        updatedAt: new Date(),
      },
    ],
    })
  } catch (error) {
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: quantity } })
    throw error
  }

  const populatedOrder = await orderRepo.findById(order._id)
  await notifyOrderUser(getOrderSellerRecipient(populatedOrder), NOTIFICATION_TYPES.ORDER_CREATED, populatedOrder, 'Bạn có đơn hàng mới', buyerId)
  return populatedOrder
}

export const getOrderById = async (orderId, userContext) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureOrderReadable(order, userContext)

  if (
    order.status === ORDER_STATUS.CANCELLED &&
    [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING_PAYMENT].includes(order.paymentStatus)
  ) {
    return orderRepo.updateById(orderId, { paymentStatus: PAYMENT_STATUS.CANCELLED })
  }

  return order
}

export const getOrders = async (userContext, query, { page, limit, skip, sortBy, sortOrder }) => {
  await normalizeCancelledPaymentStatuses()
  const filter = { isActive: true }

  const scope = query.scope || 'buyer'
  const adminRequest = isAdmin(userContext)
  if (!adminRequest && scope === 'shop') {
    const permittedShopIds = await getPermittedShopIds(userContext._id, PERMISSIONS.SHOP_ORDER_READ)
    filter.shop = { $in: permittedShopIds }
  } else if (!adminRequest && scope === 'seller') {
    filter.seller = userContext._id
  } else if (!adminRequest) {
    filter.buyer = userContext._id
  }

  if (query.status) {
    filter.status = query.status
  }

  if (adminRequest && query.shopId) {
    filter.shop = query.shopId
  }

  if (adminRequest && query.sellerId) {
    filter.seller = query.sellerId
  }

  const [orders, total] = await Promise.all([
    orderRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    orderRepo.countMany(filter),
  ])

  return { orders, meta: buildPaginationMeta(total, page, limit) }
}

export const getAdminOrders = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  await normalizeCancelledPaymentStatuses()
  const filter = { isActive: true }

  if (query.orderCode) {
    const value = String(query.orderCode).trim()
    filter.$or = [
      { paymentRef: { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { note: { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ]
    if (/^[a-f\d]{24}$/i.test(value)) {
      filter.$or.push({ _id: value })
    }
  }
  if (query.buyerId) filter.buyer = query.buyerId
  if (query.shopId) filter.shop = query.shopId
  if (query.sellerId) filter.seller = query.sellerId
  if (query.status) filter.status = query.status
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod
  if (query.createdFrom || query.createdTo) {
    filter.createdAt = {}
    if (query.createdFrom) filter.createdAt.$gte = new Date(query.createdFrom)
    if (query.createdTo) filter.createdAt.$lte = new Date(query.createdTo)
  }
  if (query.minTotal !== undefined || query.maxTotal !== undefined) {
    filter.totalAmount = {}
    if (query.minTotal !== undefined) filter.totalAmount.$gte = Number(query.minTotal)
    if (query.maxTotal !== undefined) filter.totalAmount.$lte = Number(query.maxTotal)
  }

  const [orders, total] = await Promise.all([
    orderRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    orderRepo.countMany(filter),
  ])

  return { orders, meta: buildPaginationMeta(total, page, limit) }
}

export const getAdminOrderById = async (orderId) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }
  const payment = await paymentRepo.findByOrder(order._id)
  const resolvedSeller = order.seller
    || order.shop?.owner
    || order.product?.seller
    || order.product?.shop?.owner
    || null
  const orderResponse = order.toObject()
  if (!orderResponse.seller && resolvedSeller) orderResponse.seller = resolvedSeller

  return {
    order: orderResponse,
    buyer: order.buyer,
    shop: order.shop,
    seller: resolvedSeller,
    items: [{ product: order.product, quantity: order.quantity, unitPrice: order.unitPrice }],
    amount: {
      unitPrice: order.unitPrice,
      quantity: order.quantity,
      totalAmount: order.totalAmount,
      discount: 0,
      shipping: 0,
    },
    paymentSummary: payment
      ? {
          _id: payment._id,
          amount: payment.amount,
          provider: payment.provider,
          method: payment.method,
          status: payment.status,
          transactionRef: payment.transactionRef,
          responseCode: payment.responseCode,
          paidAt: payment.paidAt,
          settlementStatus: order.settlementStatus,
          grossAmount: order.grossAmount,
          totalPlatformFee: order.totalPlatformFee,
          netSettlementAmount: order.netSettlementAmount,
        }
      : null,
    settlementSummary: {
      grossAmount: order.grossAmount,
      totalPlatformFee: order.totalPlatformFee,
      netSettlementAmount: order.netSettlementAmount,
      settlementStatus: order.settlementStatus,
      feePolicyId: order.feePolicyId || null,
      feeSnapshotId: order.feeSnapshotId || null,
    },
    statusHistory: order.history || [],
    cancellationInformation: order.status === ORDER_STATUS.CANCELLED ? order.history?.filter((item) => item.status === ORDER_STATUS.CANCELLED) || [] : [],
    refundInformation: {
      paymentStatus: order.paymentStatus,
      refundPending: order.paymentStatus === PAYMENT_STATUS.REFUND_PENDING,
    },
  }
}

export const confirmOrder = async (orderId, userContext) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureShopManageOrder(order, userContext, PERMISSIONS.SHOP_ORDER_CONFIRM)
  ensureTransitionAllowed(order.status, ORDER_STATUS.CONFIRMED)

  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng chưa được thanh toán, không thể xác nhận', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PAYMENT_REQUIRED)
  }

  const updated = await orderRepo.updateById(orderId, {
    status: ORDER_STATUS.CONFIRMED,
    $push: {
      history: {
        status: ORDER_STATUS.CONFIRMED,
        note: 'Shop xác nhận đơn hàng',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  await notifyOrderUser(updated.buyer?._id || updated.buyer, NOTIFICATION_TYPES.ORDER_CONFIRMED, updated, 'Đơn hàng của bạn đã được xác nhận', userContext._id)
  return updated
}

export const confirmOrderReceived = async (orderId, userContext) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  const buyerId = order.buyer?._id?.toString() || order.buyer?.toString()
  if (buyerId !== userContext._id.toString()) {
    throw new AppError('Bạn không có quyền xác nhận đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Chỉ có thể xác nhận sau khi đơn hàng đã giao thành công', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng chưa được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PAYMENT_REQUIRED)
  }

  const customerReceivedAt = new Date()
  const deliveredHistory = [...(order.history || [])].reverse().find((entry) => entry.status === ORDER_STATUS.DELIVERED)
  const deliveredAt = order.deliveredAt || deliveredHistory?.updatedAt || customerReceivedAt
  const shopSettlementReleaseAt = new Date(new Date(deliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  const updated = await orderRepo.updateById(orderId, {
    status: ORDER_STATUS.COMPLETED,
    customerReceivedAt,
    shopSettlementReleaseAt,
    $push: {
      history: {
        status: ORDER_STATUS.COMPLETED,
        note: 'Người mua xác nhận đã nhận được hàng',
        updatedBy: userContext._id,
        updatedAt: customerReceivedAt,
      },
    },
  })

  await ledgerService.recognizeOrderRevenue(orderId)
  await notifyOrderUser(getOrderSellerRecipient(updated), NOTIFICATION_TYPES.ORDER_DELIVERED, updated, 'Người mua đã xác nhận nhận được hàng', userContext._id)
  return updated
}

export const submitDeliveryReport = async (orderId, userContext, { note = '' } = {}, evidenceFiles = []) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureShopManageOrder(order, userContext, PERMISSIONS.SHOP_ORDER_UPDATE_STATUS)

  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Chỉ có thể báo cáo giao hàng sau khi đơn đã được giao', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng chưa được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PAYMENT_REQUIRED)
  }
  if (order.deliveryReport?.status === 'submitted') {
    throw new AppError('Báo cáo giao hàng đang chờ quản trị viên kiểm tra', HTTP_STATUS.CONFLICT, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
  if (!evidenceFiles.length) {
    throw new AppError('Vui lòng tải lên ít nhất một ảnh bằng chứng giao hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }

  const uploadedImages = []
  try {
    for (const file of evidenceFiles) {
      const image = await uploadBuffer(file.buffer, 'anh-decor/orders/delivery-evidence')
      uploadedImages.push({ url: image.url, publicId: image.publicId })
    }

    const previousImageIds = (order.deliveryReport?.evidenceImages || []).map((image) => image.publicId).filter(Boolean)
    const submittedAt = new Date()
    const updated = await orderRepo.updateById(orderId, {
      $set: {
        deliveryReport: {
          status: 'submitted',
          submittedBy: userContext._id,
          note: note.trim(),
          evidenceImages: uploadedImages,
          submittedAt,
          reviewedBy: null,
          reviewedAt: null,
          adminNote: '',
        },
      },
      $push: {
        history: {
          status: ORDER_STATUS.DELIVERED,
          note: 'Shop đã gửi bằng chứng giao hàng để quản trị viên kiểm tra',
          updatedBy: userContext._id,
          updatedAt: submittedAt,
        },
      },
    })

    await Promise.allSettled(previousImageIds.map((publicId) => deleteImage(publicId)))
    return updated
  } catch (error) {
    await Promise.allSettled(uploadedImages.map((image) => deleteImage(image.publicId)))
    throw error
  }
}

export const cancelOrder = async (orderId, userContext, note = '') => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  const userId = userContext?._id?.toString()
  const isBuyer = order.buyer?._id?.toString() === userId || order.buyer?.toString() === userId

  if (!isBuyer) {
    await ensureShopManageOrder(order, userContext, PERMISSIONS.SHOP_ORDER_CANCEL)
  }

  ensureTransitionAllowed(order.status, ORDER_STATUS.CANCELLED)

  const cancelUpdate = {
    status: ORDER_STATUS.CANCELLED,
    $push: {
      history: {
        status: ORDER_STATUS.CANCELLED,
        note: note || 'Hủy đơn hàng',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    // Đơn thanh toán bằng ví → hoàn tiền ngay lập tức
    if (order.paymentMethod === 'wallet') {
      cancelUpdate.paymentStatus = PAYMENT_STATUS.UNPAID
    } else {
      // Thanh toán qua cổng PayOS → admin xử lý hoàn tiền thủ công
      cancelUpdate.paymentStatus = PAYMENT_STATUS.REFUND_PENDING
    }
  } else if (order.paymentStatus === PAYMENT_STATUS.PENDING_PAYMENT) {
    cancelUpdate.paymentStatus = PAYMENT_STATUS.CANCELLED
  }

  const updated = await orderRepo.updateById(orderId, cancelUpdate)

  const releasedInventory = await Order.findOneAndUpdate(
    { _id: orderId, inventoryStatus: 'reserved' },
    { $set: { inventoryStatus: 'released', inventoryReleasedAt: new Date() } },
    { returnDocument: 'after' }
  )
  if (releasedInventory) {
    await Product.findByIdAndUpdate(order.product?._id || order.product, { $inc: { stock: order.quantity } })
  }
  if (order.paymentStatus === PAYMENT_STATUS.PAID || order.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) {
    await ledgerService.reverseOrderSettlement(orderId, { source: 'order_cancel', reason: note || 'Order cancelled' })
  }

  // Tự động hoàn ví nếu đơn thanh toán bằng ví
  if (order.paymentStatus === PAYMENT_STATUS.PAID && order.paymentMethod === 'wallet') {
    await userWalletService.refundWalletForOrder(order)
    await notifyOrderUser(order.buyer?._id || order.buyer, NOTIFICATION_TYPES.PAYMENT_REFUNDED, updated, 'Khoản thanh toán đã được hoàn vào ví')
  }

  const recipient = isBuyer ? getOrderSellerRecipient(order) : order.buyer?._id || order.buyer
  const type = isBuyer ? NOTIFICATION_TYPES.ORDER_CANCELLED_BY_BUYER : NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER
  await notifyOrderUser(recipient, type, updated, 'Đơn hàng đã bị hủy', userContext._id)
  if (updated.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) {
    await notifyOrderUser(order.buyer?._id || order.buyer, NOTIFICATION_TYPES.ORDER_REFUND_REQUESTED, updated, 'Yêu cầu hoàn tiền đang chờ xử lý')
  }
  return updated
}

export const updateOrderStatus = async (orderId, userContext, nextStatus, note = '') => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureShopManageOrder(order, userContext, PERMISSIONS.SHOP_ORDER_UPDATE_STATUS)
  ensureTransitionAllowed(order.status, nextStatus)

  if (nextStatus === ORDER_STATUS.COMPLETED) {
    throw new AppError('Đơn hàng chỉ được hoàn tất khi người mua xác nhận đã nhận hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }

  if (nextStatus === ORDER_STATUS.CANCELLED) {
    return cancelOrder(orderId, userContext, note)
  }

  const updated = await orderRepo.updateById(orderId, {
    status: nextStatus,
    $push: {
      history: {
        status: nextStatus,
        note: note || `Cập nhật trạng thái sang ${nextStatus}`,
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  if (nextStatus === ORDER_STATUS.DELIVERED) {
    await Order.findByIdAndUpdate(orderId, { inventoryStatus: 'consumed', deliveredAt: new Date() })
    await Product.findOneAndUpdate({ _id: order.product?._id || order.product, stock: { $lte: 0 } }, { status: 'sold' })
  }

  const typeByStatus = {
    [ORDER_STATUS.PROCESSING]: NOTIFICATION_TYPES.ORDER_PREPARING,
    [ORDER_STATUS.SHIPPED]: NOTIFICATION_TYPES.ORDER_SHIPPING,
    [ORDER_STATUS.DELIVERED]: NOTIFICATION_TYPES.ORDER_DELIVERED,
    [ORDER_STATUS.CANCELLED]: NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER,
  }
  if (typeByStatus[nextStatus]) {
    await notifyOrderUser(updated.buyer?._id || updated.buyer, typeByStatus[nextStatus], updated, `Trạng thái đơn hàng đã được cập nhật: ${nextStatus}`, userContext._id)
  }

  return updated
}

export const updateAdminOrderStatus = async (orderId, userContext, { status, reason = '', adminNote = '' }) => {
  const before = await orderRepo.findById(orderId)
  const updated = await updateOrderStatus(orderId, userContext, status, adminNote || reason)
  await writeAuditLog({
    adminId: userContext._id,
    action: 'ORDER_STATUS_CHANGED',
    targetType: 'order',
    targetId: updated._id,
    previousStatus: before?.status || '',
    newStatus: status,
    reason,
    adminNote,
  })
  return updated
}

export const confirmOrderReceivedByAdmin = async (orderId, userContext, { adminNote = '' } = {}) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }
  if (order.status !== ORDER_STATUS.DELIVERED) {
    throw new AppError('Chỉ có thể xác nhận hoàn tất từ trạng thái đã giao', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng chưa được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PAYMENT_REQUIRED)
  }

  if (order.deliveryReport?.status !== 'submitted' || !order.deliveryReport.evidenceImages?.length) {
    throw new AppError('Shop chưa gửi bằng chứng giao hàng hợp lệ để kiểm tra', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }

  const customerReceivedAt = new Date()
  const deliveredHistory = [...(order.history || [])].reverse().find((entry) => entry.status === ORDER_STATUS.DELIVERED)
  const deliveredAt = order.deliveredAt || deliveredHistory?.updatedAt || customerReceivedAt
  const shopSettlementReleaseAt = new Date(new Date(deliveredAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  const updated = await orderRepo.updateById(orderId, {
    $set: {
      status: ORDER_STATUS.COMPLETED,
      customerReceivedAt,
      shopSettlementReleaseAt,
      'deliveryReport.status': 'approved',
      'deliveryReport.reviewedBy': userContext._id,
      'deliveryReport.reviewedAt': customerReceivedAt,
      'deliveryReport.adminNote': adminNote.trim(),
    },
    $push: {
      history: {
        status: ORDER_STATUS.COMPLETED,
        note: 'Admin xác nhận hoàn tất dựa trên bằng chứng giao hàng',
        updatedBy: userContext._id,
        updatedAt: customerReceivedAt,
      },
    },
  })

  await ledgerService.recognizeOrderRevenue(orderId, { source: 'admin_confirmed_delivery' })
  await writeAuditLog({
    adminId: userContext._id,
    action: 'ORDER_DELIVERY_CONFIRMED_BY_ADMIN',
    targetType: 'order',
    targetId: updated._id,
    previousStatus: order.status,
    newStatus: ORDER_STATUS.COMPLETED,
    reason: 'Duyệt báo cáo giao hàng của shop',
    adminNote,
    metadata: { evidenceImageCount: order.deliveryReport.evidenceImages.length, shopSettlementReleaseAt },
  })
  await notifyOrderUser(updated.buyer?._id || updated.buyer, NOTIFICATION_TYPES.ORDER_DELIVERED, updated, 'Admin đã xác nhận đơn hàng hoàn tất', userContext._id)
  return updated
}

export const rejectOrderDeliveryReportByAdmin = async (orderId, userContext, { adminNote = '' } = {}) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }
  if (order.status !== ORDER_STATUS.DELIVERED || order.deliveryReport?.status !== 'submitted') {
    throw new AppError('Không có báo cáo giao hàng đang chờ kiểm tra', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }

  const reviewedAt = new Date()
  const updated = await orderRepo.updateById(orderId, {
    $set: {
      'deliveryReport.status': 'rejected',
      'deliveryReport.reviewedBy': userContext._id,
      'deliveryReport.reviewedAt': reviewedAt,
      'deliveryReport.adminNote': adminNote.trim(),
    },
    $push: {
      history: {
        status: ORDER_STATUS.DELIVERED,
        note: 'Quản trị viên yêu cầu bổ sung bằng chứng giao hàng',
        updatedBy: userContext._id,
        updatedAt: reviewedAt,
      },
    },
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'ORDER_DELIVERY_REPORT_REJECTED',
    targetType: 'order',
    targetId: updated._id,
    previousStatus: order.status,
    newStatus: order.status,
    adminNote: adminNote.trim(),
  })
  await notifyOrderUser(getOrderSellerRecipient(updated), NOTIFICATION_TYPES.REPORT_RESOLVED, updated, 'Quản trị viên yêu cầu bổ sung bằng chứng giao hàng', userContext._id)
  return updated
}

export const cancelAdminOrder = async (orderId, userContext, { reason = '', adminNote = '' } = {}) => {
  const before = await orderRepo.findById(orderId)
  const updated = await cancelOrder(orderId, userContext, adminNote || reason)
  await writeAuditLog({
    adminId: userContext._id,
    action: 'ORDER_CANCELLED',
    targetType: 'order',
    targetId: updated._id,
    previousStatus: before?.status || '',
    newStatus: updated.status,
    reason,
    adminNote,
  })
  return updated
}

export const refundAdminOrder = async (orderId, userContext, { reason = '', adminNote = '' } = {}) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  if (order.paymentStatus !== PAYMENT_STATUS.PAID && order.paymentStatus !== PAYMENT_STATUS.REFUND_PENDING) {
    throw new AppError('Đơn hàng không có thanh toán cần hoàn', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.NOT_FOUND)
  }

  if (order.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) {
    return order
  }

  let updated = null
  if (order.paymentMethod === 'wallet') {
    await userWalletService.refundWalletForOrder(order)
    updated = await orderRepo.updateById(orderId, { paymentStatus: PAYMENT_STATUS.UNPAID })
  } else {
    updated = await orderRepo.updateById(orderId, { paymentStatus: PAYMENT_STATUS.REFUND_PENDING })
    const payment = await paymentRepo.findByOrder(order._id)
    if (payment) {
      await paymentRepo.updateById(payment._id, {
        status: PAYMENT_STATUS.REFUND_PENDING,
        reconciledBy: userContext._id,
        reconciledAt: new Date(),
      })
    }
  }

  await ledgerService.reverseOrderSettlement(orderId, { source: 'admin_refund', reason: reason || adminNote || 'Admin refund requested' })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'ORDER_REFUND_REQUESTED',
    targetType: 'order',
    targetId: order._id,
    previousStatus: order.paymentStatus,
    newStatus: updated.paymentStatus,
    reason,
    adminNote,
  })

  return updated
}

const normalizeCancelledPaymentStatuses = async () => {
  const pendingCancelledOrders = await Order.find({
    isActive: true,
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.CANCELLED,
  }).select('_id')

  let normalizedCount = 0
  for (const order of pendingCancelledOrders) {
    if (await releaseInventoryForOrder(order._id)) normalizedCount += 1
  }

  const result = await Order.updateMany(
    {
      isActive: true,
      status: ORDER_STATUS.CANCELLED,
      paymentStatus: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PENDING_PAYMENT] },
    },
    { $set: { paymentStatus: PAYMENT_STATUS.CANCELLED } },
  )

  return normalizedCount + (result.modifiedCount ?? result.nModified ?? 0)
}

export const expirePendingOrders = async ({ olderThanMs = 15 * 60 * 1000 } = {}) => {
  const cutoff = new Date(Date.now() - olderThanMs)
  const candidates = await Order.find({
    isActive: true,
    status: { $in: [ORDER_STATUS.PENDING] },
    paymentStatus: { $ne: PAYMENT_STATUS.PAID },
    createdAt: { $lt: cutoff },
    inventoryStatus: 'reserved',
  }).select('_id buyer product quantity paymentStatus inventoryStatus')

  let expiredCount = 0
  for (const order of candidates) {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: ORDER_STATUS.PENDING, inventoryStatus: 'reserved', paymentStatus: { $ne: PAYMENT_STATUS.PAID } },
      {
        $set: {
          status: ORDER_STATUS.CANCELLED,
          paymentStatus: order.paymentStatus === PAYMENT_STATUS.PENDING_PAYMENT ? PAYMENT_STATUS.CANCELLED : order.paymentStatus,
          inventoryStatus: 'released',
          inventoryReleasedAt: new Date(),
        },
        $push: {
          history: {
            status: ORDER_STATUS.CANCELLED,
            note: 'Đơn hàng đã hết thời gian thanh toán và được huỷ',
            updatedBy: order.buyer,
            updatedAt: new Date(),
          },
        },
      },
      { returnDocument: 'after' }
    )
    if (!updated) continue
    await Product.findByIdAndUpdate(order.product, { $inc: { stock: order.quantity } })
    expiredCount += 1
    await notifyOrderUser(order.buyer, NOTIFICATION_TYPES.ORDER_CANCELLED_BY_BUYER, updated, 'Đơn hàng đã hết thời gian thanh toán và được huỷ')
  }
  await normalizeCancelledPaymentStatuses()
  return { expiredCount }
}

export const releaseInventoryForOrder = async (orderId) => {
  const now = new Date()
  const releasedOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      isActive: true,
      status: { $ne: ORDER_STATUS.CANCELLED },
      paymentStatus: { $ne: PAYMENT_STATUS.PAID },
      inventoryStatus: 'reserved',
    },
    {
      $set: {
        inventoryStatus: 'released',
        inventoryReleasedAt: now,
        status: ORDER_STATUS.CANCELLED,
      },
      $push: {
        history: {
          status: ORDER_STATUS.CANCELLED,
          note: 'Thanh toán không thành công hoặc đã bị huỷ',
          updatedAt: now,
        },
      },
    },
    { returnDocument: 'after' }
  )

  if (releasedOrder) {
    await Product.findByIdAndUpdate(releasedOrder.product, { $inc: { stock: releasedOrder.quantity } })
    return true
  }

  const cancelledOrder = await Order.findOneAndUpdate(
    {
      _id: orderId,
      isActive: true,
      status: { $ne: ORDER_STATUS.CANCELLED },
      paymentStatus: { $ne: PAYMENT_STATUS.PAID },
    },
    {
      $set: { status: ORDER_STATUS.CANCELLED },
      $push: {
        history: {
          status: ORDER_STATUS.CANCELLED,
          note: 'Thanh toán không thành công hoặc đã bị huỷ',
          updatedAt: now,
        },
      },
    },
    { returnDocument: 'after' },
  )

  if (!cancelledOrder) return false
  return true
}

export const releaseDueOrderSettlements = async () => {
  const candidates = await Order.find({
    isActive: true,
    status: ORDER_STATUS.COMPLETED,
    paymentStatus: PAYMENT_STATUS.PAID,
    settlementStatus: { $in: ['held', 'pending'] },
    shopSettlementReleaseAt: { $lte: new Date() },
  }).select('_id')

  let releasedCount = 0
  for (const order of candidates) {
    const released = await ledgerService.releaseOrderSettlement(order._id)
    if (released?.settlementStatus === 'settled') releasedCount += 1
  }
  return { releasedCount }
}
