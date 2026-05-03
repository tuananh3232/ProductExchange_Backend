import User from '../../models/user.model.js'
import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import { ORDER_STATUS, DELIVERY_STATUS } from '../../constants/status.constant.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import * as orderRepo from '../../repositories/order/order.repository.js'
import * as deliveryRepo from '../../repositories/delivery/delivery.repository.js'

const isAdmin = (userContext) => (userContext?.roles || []).includes('admin')

const getManagedShopIds = async (userId) => {
  const shops = await Shop.find({
    isActive: true,
    $or: [{ owner: userId }, { staff: userId }],
  }).select('_id')

  return shops.map((shop) => shop._id.toString())
}

const ensureCanManageOrderDelivery = async (order, userContext) => {
  if (isAdmin(userContext)) return

  const managedShopIds = await getManagedShopIds(userContext._id)
  const shopId = order.shop?._id?.toString() || order.shop?.toString()
  if (!shopId || !managedShopIds.includes(shopId)) {
    throw new AppError('Bạn không có quyền gán đơn giao hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.DELIVERY.NOT_ALLOWED_ASSIGN)
  }
}

const ensureIsAssignedDeliveryStaff = (delivery, userContext) => {
  const assignedId = delivery.deliveryStaff?._id?.toString() || delivery.deliveryStaff?.toString()
  if (assignedId !== userContext?._id?.toString()) {
    throw new AppError('Bạn không phải nhân viên giao hàng của đơn này', HTTP_STATUS.FORBIDDEN, ERRORS.DELIVERY.NOT_ASSIGNED_STAFF)
  }
}

const ensureDeliveryTransition = (currentStatus, nextStatus) => {
  const transitions = {
    [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.FAILED],
    [DELIVERY_STATUS.PICKED_UP]: [DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.FAILED],
    [DELIVERY_STATUS.IN_TRANSIT]: [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.FAILED],
    [DELIVERY_STATUS.DELIVERED]: [],
    [DELIVERY_STATUS.FAILED]: [DELIVERY_STATUS.ASSIGNED],
  }

  const allowed = transitions[currentStatus] || []
  if (!allowed.includes(nextStatus)) {
    throw new AppError('Không thể chuyển trạng thái giao hàng theo vòng đời hiện tại', HTTP_STATUS.BAD_REQUEST, ERRORS.DELIVERY.INVALID_STATUS_TRANSITION)
  }
}

const pushHistory = (status, updatedBy, note = '') => ({
  status,
  updatedBy,
  note,
  updatedAt: new Date(),
})

export const assignDelivery = async (payload, userContext) => {
  const { orderId, deliveryUserId, note = '' } = payload

  const order = await orderRepo.findById(orderId)
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  await ensureCanManageOrderDelivery(order, userContext)

  if (![ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED].includes(order.status)) {
    throw new AppError('Đơn hàng chưa sẵn sàng để gán giao hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.DELIVERY.ORDER_NOT_READY)
  }

  const deliveryUser = await User.findById(deliveryUserId)
  if (!deliveryUser || !deliveryUser.isActive) {
    throw new AppError('Không tìm thấy nhân viên giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.STAFF_NOT_FOUND)
  }

  const roleSet = new Set(deliveryUser.roles || [deliveryUser.role].filter(Boolean))
  roleSet.add('delivery')
  deliveryUser.roles = [...roleSet]
  if (!deliveryUser.role) {
    deliveryUser.role = 'delivery'
  }
  await deliveryUser.save()

  const existed = await deliveryRepo.findByOrderId(orderId)
  if (existed) {
    const updated = await deliveryRepo.updateById(existed._id, {
      deliveryStaff: deliveryUserId,
      status: DELIVERY_STATUS.ASSIGNED,
      acceptedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      failedReason: '',
      $push: {
        history: pushHistory(DELIVERY_STATUS.ASSIGNED, userContext._id, note || 'Gán lại nhân viên giao hàng'),
      },
    })

    await orderRepo.updateById(orderId, {
      deliveryStaff: deliveryUserId,
      $push: {
        history: {
          status: order.status,
          note: 'Cập nhật phân công giao hàng',
          updatedBy: userContext._id,
          updatedAt: new Date(),
        },
      },
    })

    return updated
  }

  const delivery = await deliveryRepo.create({
    order: order._id,
    shop: order.shop?._id || order.shop,
    buyer: order.buyer?._id || order.buyer,
    deliveryStaff: deliveryUserId,
    status: DELIVERY_STATUS.ASSIGNED,
    history: [pushHistory(DELIVERY_STATUS.ASSIGNED, userContext._id, note || 'Gán đơn cho nhân viên giao hàng')],
  })

  await orderRepo.updateById(orderId, {
    deliveryStaff: deliveryUserId,
    $push: {
      history: {
        status: order.status,
        note: 'Đơn hàng đã được gán cho nhân viên giao',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  return deliveryRepo.findById(delivery._id)
}

export const getDeliveryById = async (deliveryId, userContext) => {
  const delivery = await deliveryRepo.findById(deliveryId)
  if (!delivery || !delivery.isActive) {
    throw new AppError('Không tìm thấy đơn giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.NOT_FOUND)
  }

  if (isAdmin(userContext)) return delivery

  const userId = userContext?._id?.toString()
  const buyerId = delivery.buyer?._id?.toString() || delivery.buyer?.toString()
  const staffId = delivery.deliveryStaff?._id?.toString() || delivery.deliveryStaff?.toString()
  const shopOwnerId = delivery.shop?.owner?._id?.toString() || delivery.shop?.owner?.toString()
  const shopStaffIds = (delivery.shop?.staff || []).map((item) => item?._id?.toString() || item?.toString())

  if ([buyerId, staffId, shopOwnerId].includes(userId) || shopStaffIds.includes(userId)) {
    return delivery
  }

  throw new AppError('Bạn không có quyền xem đơn giao hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
}

export const getMyDeliveries = async (userContext, query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }

  if (!isAdmin(userContext)) {
    filter.deliveryStaff = userContext._id
  }

  if (query.status) {
    filter.status = query.status
  }

  const [deliveries, total] = await Promise.all([
    deliveryRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    deliveryRepo.countMany(filter),
  ])

  return { deliveries, meta: buildPaginationMeta(total, page, limit) }
}

export const acceptDelivery = async (deliveryId, userContext) => {
  const delivery = await deliveryRepo.findById(deliveryId)
  if (!delivery || !delivery.isActive) {
    throw new AppError('Không tìm thấy đơn giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.NOT_FOUND)
  }

  ensureIsAssignedDeliveryStaff(delivery, userContext)

  if (delivery.acceptedAt) {
    return delivery
  }

  return deliveryRepo.updateById(deliveryId, {
    acceptedAt: new Date(),
    $push: {
      history: pushHistory(DELIVERY_STATUS.ASSIGNED, userContext._id, 'Nhân viên giao hàng đã nhận đơn'),
    },
  })
}

export const pickupOrder = async (deliveryId, userContext, note = '') => {
  const delivery = await deliveryRepo.findById(deliveryId)
  if (!delivery || !delivery.isActive) {
    throw new AppError('Không tìm thấy đơn giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.NOT_FOUND)
  }

  ensureIsAssignedDeliveryStaff(delivery, userContext)
  ensureDeliveryTransition(delivery.status, DELIVERY_STATUS.PICKED_UP)

  const updated = await deliveryRepo.updateById(deliveryId, {
    status: DELIVERY_STATUS.PICKED_UP,
    pickedUpAt: new Date(),
    failedReason: '',
    $push: {
      history: pushHistory(DELIVERY_STATUS.PICKED_UP, userContext._id, note || 'Đã lấy hàng từ shop'),
    },
  })

  await orderRepo.updateById(delivery.order?._id || delivery.order, {
    status: ORDER_STATUS.SHIPPED,
    $push: {
      history: {
        status: ORDER_STATUS.SHIPPED,
        note: 'Đơn hàng đang được giao sau khi lấy hàng',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  return updated
}

export const updateDeliveryStatus = async (deliveryId, userContext, nextStatus, note = '') => {
  const delivery = await deliveryRepo.findById(deliveryId)
  if (!delivery || !delivery.isActive) {
    throw new AppError('Không tìm thấy đơn giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.NOT_FOUND)
  }

  ensureIsAssignedDeliveryStaff(delivery, userContext)

  if (![DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.FAILED].includes(nextStatus)) {
    throw new AppError('Trạng thái giao hàng không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.DELIVERY.INVALID_STATUS_TRANSITION)
  }

  ensureDeliveryTransition(delivery.status, nextStatus)

  const updateDoc = {
    status: nextStatus,
    $push: {
      history: pushHistory(nextStatus, userContext._id, note || `Cập nhật trạng thái giao hàng: ${nextStatus}`),
    },
  }

  if (nextStatus === DELIVERY_STATUS.FAILED) {
    updateDoc.failedReason = note || 'Giao hàng thất bại'
  } else {
    updateDoc.failedReason = ''
  }

  const updated = await deliveryRepo.updateById(deliveryId, updateDoc)

  if (nextStatus === DELIVERY_STATUS.FAILED) {
    await orderRepo.updateById(delivery.order?._id || delivery.order, {
      status: ORDER_STATUS.PROCESSING,
      $push: {
        history: {
          status: ORDER_STATUS.PROCESSING,
          note: 'Giao hàng thất bại, quay lại xử lý',
          updatedBy: userContext._id,
          updatedAt: new Date(),
        },
      },
    })
  }

  return updated
}

export const completeDelivery = async (deliveryId, userContext, note = '') => {
  const delivery = await deliveryRepo.findById(deliveryId)
  if (!delivery || !delivery.isActive) {
    throw new AppError('Không tìm thấy đơn giao hàng', HTTP_STATUS.NOT_FOUND, ERRORS.DELIVERY.NOT_FOUND)
  }

  ensureIsAssignedDeliveryStaff(delivery, userContext)
  ensureDeliveryTransition(delivery.status, DELIVERY_STATUS.DELIVERED)

  const updated = await deliveryRepo.updateById(deliveryId, {
    status: DELIVERY_STATUS.DELIVERED,
    deliveredAt: new Date(),
    failedReason: '',
    $push: {
      history: pushHistory(DELIVERY_STATUS.DELIVERED, userContext._id, note || 'Hoàn tất giao hàng'),
    },
  })

  await orderRepo.updateById(delivery.order?._id || delivery.order, {
    status: ORDER_STATUS.DELIVERED,
    $push: {
      history: {
        status: ORDER_STATUS.DELIVERED,
        note: 'Đơn hàng đã giao thành công',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    },
  })

  const orderProductId = delivery.order?.product?._id || delivery.order?.product
  if (orderProductId) {
    await Product.findByIdAndUpdate(orderProductId, { status: 'sold' })
  }

  return updated
}
