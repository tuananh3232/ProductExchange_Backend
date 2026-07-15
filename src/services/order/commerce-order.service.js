import Order from '../../models/order.model.js'
import Shop from '../../models/shop.model.js'
import Shipment from '../../models/shipment.model.js'
import Wallet from '../../models/wallet.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import InventoryReservation from '../../models/inventory-reservation.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { COMMERCE_ORDER_STATUS } from '../../constants/commerce.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { releaseReservation } from '../inventory/inventory.service.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'
import JobLease from '../../models/job-lease.model.js'
import OrderCase from '../../models/order-case.model.js'
import { env } from '../../configs/env.config.js'

const findOrder = async (orderId, session = null) => {
  const query = Order.findById(orderId)
  if (session) query.session(session)
  const order = await query
  if (!order) throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, 'ORDER_NOT_FOUND')
  return order
}

const assertBuyer = (order, userId) => {
  if (String(order.buyer) !== String(userId)) throw new AppError('Bạn không có quyền với đơn hàng này', HTTP_STATUS.FORBIDDEN, 'ORDER_ACCESS_DENIED')
}

const assertMerchant = async (order, userId, session = null) => {
  if (order.seller && String(order.seller) === String(userId)) return
  if (order.shop) {
    const query = Shop.exists({ _id: order.shop, owner: userId, status: 'active', isActive: true })
    if (session) query.session(session)
    if (await query) return
  }
  throw new AppError('Bạn không có quyền xử lý đơn hàng này', HTTP_STATUS.FORBIDDEN, 'MERCHANT_ACCESS_DENIED')
}

const transition = async ({ orderId, userId, allowed, target, merchant = false, update = {} }) => runRequiredMongoTransaction(async (session) => {
  const order = await findOrder(orderId, session)
  if (merchant) await assertMerchant(order, userId, session)
  else assertBuyer(order, userId)
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, commerceStatus: { $in: allowed } },
    { commerceStatus: target, ...update },
    { returnDocument: 'after', session }
  )
  if (!updated) throw new AppError('Trạng thái đơn hàng không cho phép thao tác này', HTTP_STATUS.CONFLICT, 'INVALID_ORDER_TRANSITION')
  return updated
})

export const listBuyerOrders = (buyerId) => Order.find({ buyer: buyerId, checkout: { $ne: null } })
  .sort({ createdAt: -1 })

export const getBuyerOrder = async (orderId, buyerId) => {
  const order = await Order.findOne({ _id: orderId, buyer: buyerId }).populate('checkout')
  if (!order) throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, 'ORDER_NOT_FOUND')
  return order
}

export const confirmOrder = (orderId, userId) => transition({
  orderId,
  userId,
  merchant: true,
  allowed: [COMMERCE_ORDER_STATUS.PAID_HELD],
  target: COMMERCE_ORDER_STATUS.SELLER_CONFIRMED,
})

export const processOrder = (orderId, userId) => transition({
  orderId,
  userId,
  merchant: true,
  allowed: [COMMERCE_ORDER_STATUS.SELLER_CONFIRMED],
  target: COMMERCE_ORDER_STATUS.PROCESSING,
})

export const shipOrder = ({ orderId, userId, carrier, trackingCode, proof = [] }) => runRequiredMongoTransaction(async (session) => {
  const order = await findOrder(orderId, session)
  await assertMerchant(order, userId, session)
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, commerceStatus: COMMERCE_ORDER_STATUS.PROCESSING },
    { commerceStatus: COMMERCE_ORDER_STATUS.SHIPPED },
    { returnDocument: 'after', session }
  )
  if (!updated) throw new AppError('Đơn hàng chưa sẵn sàng giao', HTTP_STATUS.CONFLICT, 'INVALID_ORDER_TRANSITION')
  await Shipment.create([{
    order: order._id,
    carrier,
    trackingCode,
    proof,
    status: 'shipped',
    shippedAt: new Date(),
    events: [{ status: 'shipped', actor: userId }],
  }], { session })
  return updated
})

export const markDelivered = (orderId, userId) => runRequiredMongoTransaction(async (session) => {
  const order = await findOrder(orderId, session)
  await assertMerchant(order, userId, session)
  const deliveredAt = new Date()
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, commerceStatus: COMMERCE_ORDER_STATUS.SHIPPED },
    { commerceStatus: COMMERCE_ORDER_STATUS.DELIVERED_PENDING_CONFIRMATION, deliveredAt },
    { returnDocument: 'after', session }
  )
  if (!updated) throw new AppError('Đơn hàng chưa ở trạng thái đang giao', HTTP_STATUS.CONFLICT, 'INVALID_ORDER_TRANSITION')
  await Shipment.updateOne(
    { order: order._id },
    { status: 'delivered', deliveredAt, $push: { events: { status: 'delivered', actor: userId, at: deliveredAt } } },
    { session }
  )
  await JobLease.create([{
    jobKey: `order-auto-complete:${order._id}`,
    jobType: 'order_auto_complete',
    payload: { orderId: order._id },
    runAt: new Date(deliveredAt.getTime() + env.commerce.confirmationWindowHours * 60 * 60 * 1000),
  }], { session })
  return updated
})

const releaseSettlement = async (order, session) => {
  if (order.settlementReleasedAt) return order
  const fee = Math.max(0, Number(order.totalPlatformFee || 0))
  const net = Number(order.amountBreakdown?.total || order.totalAmount) - fee
  const merchantAccount = order.shop
    ? accountDefinitions.shopAvailable(order.shop)
    : accountDefinitions.sellerAvailable(order.seller)
  const entries = [
    { account: accountDefinitions.orderEscrow(order.checkout), direction: 'debit', amount: net + fee },
    { account: merchantAccount, direction: 'credit', amount: net },
  ]
  if (fee) entries.push({ account: accountDefinitions.platformRevenue(), direction: 'credit', amount: fee })
  await postBalancedTransaction({
    commandKey: `order_settlement:${order._id}`,
    transactionType: 'order_settlement',
    referenceType: 'Order',
    referenceId: order._id,
    entries,
  }, session)
  if (order.shop) {
    await Wallet.findOneAndUpdate(
      { shop: order.shop },
      { $inc: { balance: net, totalEarned: net } },
      { upsert: true, session }
    )
  } else {
    await UserWallet.findOneAndUpdate(
      { user: order.seller },
      { $inc: { balance: net } },
      { upsert: true, session }
    )
  }
  order.settlementReleasedAt = new Date()
  order.netSettlementAmount = net
  return order.save({ session })
}

export const confirmReceived = (orderId, buyerId) => runRequiredMongoTransaction(async (session) => {
  const order = await findOrder(orderId, session)
  assertBuyer(order, buyerId)
  if (![COMMERCE_ORDER_STATUS.SHIPPED, COMMERCE_ORDER_STATUS.DELIVERED_PENDING_CONFIRMATION].includes(order.commerceStatus)) {
    throw new AppError('Đơn hàng chưa thể xác nhận đã nhận', HTTP_STATUS.CONFLICT, 'INVALID_ORDER_TRANSITION')
  }
  order.commerceStatus = COMMERCE_ORDER_STATUS.COMPLETED
  order.completedAt = new Date()
  await order.save({ session })
  return releaseSettlement(order, session)
})

export const autoCompleteOrder = (orderId) => runRequiredMongoTransaction(async (session) => {
  const openCase = await OrderCase.exists({
    order: orderId,
    status: { $in: ['open', 'seller_responded', 'under_review'] },
  }).session(session)
  if (openCase) return null
  const order = await Order.findOneAndUpdate(
    { _id: orderId, commerceStatus: COMMERCE_ORDER_STATUS.DELIVERED_PENDING_CONFIRMATION },
    { commerceStatus: COMMERCE_ORDER_STATUS.COMPLETED, completedAt: new Date() },
    { returnDocument: 'after', session }
  )
  if (!order) return null
  return releaseSettlement(order, session)
})

export const cancelOrder = (orderId, buyerId) => runRequiredMongoTransaction(async (session) => {
  const order = await findOrder(orderId, session)
  assertBuyer(order, buyerId)
  if (order.commerceStatus !== COMMERCE_ORDER_STATUS.PAYMENT_PENDING) {
    throw new AppError('Không thể hủy đơn hàng ở trạng thái hiện tại', HTTP_STATUS.CONFLICT, 'INVALID_ORDER_TRANSITION')
  }
  order.commerceStatus = COMMERCE_ORDER_STATUS.CANCELLED
  await order.save({ session })
  const reservations = await InventoryReservation.find({ order: order._id }).session(session)
  for (const reservation of reservations) await releaseReservation(reservation._id, session)
  return order
})
