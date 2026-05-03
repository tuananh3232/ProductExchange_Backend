import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ORDER_STATUS } from '../../constants/status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import * as orderRepo from '../../repositories/order/order.repository.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const ORDER_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
}

const getManagedShopIds = async (userId) => {
  const shops = await Shop.find({
    isActive: true,
    $or: [{ owner: userId }, { staff: userId }],
  }).select('_id')

  return shops.map((shop) => shop._id.toString())
}

const isAdmin = (userContext) => (userContext?.roles || []).includes('admin')

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
    return
  }

  throw new AppError('Bạn không có quyền xem đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
}

const ensureShopManageOrder = async (order, userContext, permissionKey) => {
  if (isAdmin(userContext)) return

  const orderShopId = order.shop?._id?.toString() || order.shop?.toString()
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
  const product = await Product.findById(payload.productId).select('_id owner shop status listingType price isActive title')
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

  if (!product.shop) {
    throw new AppError('Sản phẩm chưa gắn với shop', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_MISSING_SHOP)
  }

  const quantity = payload.quantity || 1
  const unitPrice = product.price
  const totalAmount = unitPrice * quantity

  const order = await orderRepo.create({
    buyer: buyerId,
    shop: product.shop,
    product: product._id,
    quantity,
    unitPrice,
    totalAmount,
    status: ORDER_STATUS.PENDING,
    shippingAddress: payload.shippingAddress || {},
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

  return orderRepo.findById(order._id)
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
    const managedShopIds = await getManagedShopIds(userContext._id)
    filter.shop = { $in: managedShopIds }
  } else if (!isAdmin(userContext) && scope === 'buyer') {
    filter.buyer = userContext._id
  }

  if (query.status) {
    filter.status = query.status
  }

  if (query.shopId) {
    filter.shop = query.shopId
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

  await ensureShopManageOrder(order, userContext, PERMISSIONS.ORDER_CONFIRM)
  ensureTransitionAllowed(order.status, ORDER_STATUS.CONFIRMED)

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
    await ensureShopManageOrder(order, userContext, PERMISSIONS.ORDER_CANCEL)
  }

  ensureTransitionAllowed(order.status, ORDER_STATUS.CANCELLED)

  const updated = await orderRepo.updateById(orderId, {
    status: ORDER_STATUS.CANCELLED,
    $push: {
      history: {
        status: ORDER_STATUS.CANCELLED,
        note: note || 'Hủy đơn hàng',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  await Product.findByIdAndUpdate(order.product?._id || order.product, { status: 'available' })
  return updated
}

export const updateOrderStatus = async (orderId, userContext, nextStatus, note = '') => {
  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureShopManageOrder(order, userContext, PERMISSIONS.ORDER_UPDATE_STATUS)
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
  }

  if (nextStatus === ORDER_STATUS.CANCELLED) {
    await Product.findByIdAndUpdate(order.product?._id || order.product, { status: 'available' })
  }

  return updated
}
