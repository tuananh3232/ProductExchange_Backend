import Product, { PRODUCT_OWNER_TYPES } from '../../models/product.model.js'
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

const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

const getOrderSellerRecipient = (order) => order.shop?.owner?._id || order.shop?.owner || order.seller?._id || order.seller

const notifyOrderUser = (recipient, type, order, message, sender = null) => {
  if (!recipient) return null
  return notifySafely({
    recipient,
    sender,
    type,
    title: 'Cap nhat don hang',
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
      message: 'Báº¡n khÃ´ng cÃ³ quyá»n xem Ä‘Æ¡n hÃ ng nÃ y',
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
  const product = await Product.findById(productId).select('_id owner ownerType shop seller status listingType price isActive title')
  if (!product || !product.isActive) {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }

  if (!['sell', 'both'].includes(product.listingType)) {
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
  const unitPrice = product.price
  const totalAmount = unitPrice * quantity
  // If shippingAddress is not provided or empty, use buyer's profile address
  let shippingAddress = payload.shippingAddress || {}
  const isEmptyAddress = !shippingAddress || (!shippingAddress.province && !shippingAddress.district && !shippingAddress.detail)
  if (isEmptyAddress) {
    const buyer = await User.findById(buyerId).select('address')
    if (buyer && buyer.address) shippingAddress = buyer.address
  }

  const order = await orderRepo.create({
    buyer: buyerId,
    shop: product.ownerType === PRODUCT_OWNER_TYPES.SHOP ? product.shop : null,
    seller: product.ownerType === PRODUCT_OWNER_TYPES.SELLER ? product.seller : null,
    product: product._id,
    quantity,
    unitPrice,
    totalAmount,
    status: ORDER_STATUS.PENDING,
    shippingAddress,
    note: payload.note || '',
    history: [
      {
        status: ORDER_STATUS.PENDING,
        note: 'Tạo đơn hàng',
        updatedBy: buyerId,
        updatedAt: new Date(),
      },
    ],
  })

  await Product.findByIdAndUpdate(product._id, { status: 'pending' })

  const populatedOrder = await orderRepo.findById(order._id)
  await notifyOrderUser(getOrderSellerRecipient(populatedOrder), NOTIFICATION_TYPES.ORDER_CREATED, populatedOrder, 'Ban co don hang moi', buyerId)
  return populatedOrder
}

export const getOrderById = async (orderId, userContext) => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureOrderReadable(order, userContext)
  return order
}

export const getOrders = async (userContext, query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }

  const scope = query.scope || 'buyer'
  if (!isAdmin(userContext) && scope === 'shop') {
    const managedShopIds = await getPermittedShopIds(userContext._id, PERMISSIONS.SHOP_ORDER_READ)
    filter.shop = { $in: managedShopIds }
  } else if (!isAdmin(userContext) && scope === 'seller') {
    filter.seller = userContext._id
  } else if (!isAdmin(userContext) && scope === 'buyer') {
    filter.buyer = userContext._id
  }

  if (query.status) {
    filter.status = query.status
  }

  if (query.shopId) {
    filter.shop = query.shopId
  }

  if (query.sellerId) {
    filter.seller = query.sellerId
  }

  const [orders, total] = await Promise.all([
    orderRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    orderRepo.countMany(filter),
  ])

  return { orders, meta: buildPaginationMeta(total, page, limit) }
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
      // Thanh toán qua cổng (VNPay/PayOS) → admin xử lý hoàn tiền thủ công
      cancelUpdate.paymentStatus = PAYMENT_STATUS.REFUND_PENDING
    }
  }

  const updated = await orderRepo.updateById(orderId, cancelUpdate)

  await Product.findByIdAndUpdate(order.product?._id || order.product, { status: 'available' })

  // Tự động hoàn ví nếu đơn thanh toán bằng ví
  if (order.paymentStatus === PAYMENT_STATUS.PAID && order.paymentMethod === 'wallet') {
    await userWalletService.refundWalletForOrder(order)
    await notifyOrderUser(order.buyer?._id || order.buyer, NOTIFICATION_TYPES.PAYMENT_REFUNDED, updated, 'Khoản thanh toán đã được hoàn vào ví')
  }

  const recipient = isBuyer ? getOrderSellerRecipient(order) : order.buyer?._id || order.buyer
  const type = isBuyer ? NOTIFICATION_TYPES.ORDER_CANCELLED_BY_BUYER : NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER
  await notifyOrderUser(recipient, type, updated, 'Don hang da bi huy', userContext._id)
  if (updated.paymentStatus === PAYMENT_STATUS.REFUND_PENDING) {
    await notifyOrderUser(order.buyer?._id || order.buyer, NOTIFICATION_TYPES.ORDER_REFUND_REQUESTED, updated, 'Yeu cau hoan tien dang cho xu ly')
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
    await Product.findByIdAndUpdate(order.product?._id || order.product, { status: 'sold' })
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      await walletService.creditFromOrder(updated)
    }
  }

  if (nextStatus === ORDER_STATUS.CANCELLED) {
    await Product.findByIdAndUpdate(order.product?._id || order.product, { status: 'available' })
  }

  const typeByStatus = {
    [ORDER_STATUS.PROCESSING]: NOTIFICATION_TYPES.ORDER_PREPARING,
    [ORDER_STATUS.SHIPPED]: NOTIFICATION_TYPES.ORDER_SHIPPING,
    [ORDER_STATUS.DELIVERED]: NOTIFICATION_TYPES.ORDER_DELIVERED,
    [ORDER_STATUS.CANCELLED]: NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER,
  }
  if (typeByStatus[nextStatus]) {
    await notifyOrderUser(updated.buyer?._id || updated.buyer, typeByStatus[nextStatus], updated, `Trang thai don hang da cap nhat: ${nextStatus}`, userContext._id)
  }

  return updated
}
