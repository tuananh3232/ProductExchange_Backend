import Checkout from '../../models/checkout.model.js'
import Order from '../../models/order.model.js'
import Product from '../../models/product.model.js'
import Shop from '../../models/shop.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { reserveVariant } from '../inventory/inventory.service.js'
import { CHECKOUT_STATUS, COMMERCE_ORDER_STATUS } from '../../constants/commerce.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../../constants/status.constant.js'
import JobLease from '../../models/job-lease.model.js'
import Cart from '../../models/cart.model.js'
import { runIdempotentCommand } from '../../utils/idempotency-command.util.js'

const RESERVATION_MINUTES = 15

const mapAttributes = (value) => value instanceof Map ? Object.fromEntries(value) : value || {}

const loadCheckoutItems = async (items, buyerId) => {
  const productIds = [...new Set(items.map((item) => String(item.productId)))]
  const products = await Product.find({ _id: { $in: productIds }, isActive: true })
    .select('title images owner ownerType shop seller status transactionMode variants')
    .lean()
  const productMap = new Map(products.map((product) => [String(product._id), product]))
  const shopIds = products.map((product) => product.shop).filter(Boolean)
  const activeShops = await Shop.find({ _id: { $in: shopIds }, isActive: true, status: 'active' }).select('_id').lean()
  const activeShopIds = new Set(activeShops.map((shop) => String(shop._id)))

  return items.map((requested) => {
    const product = productMap.get(String(requested.productId))
    if (!product || product.status !== 'available' || (product.transactionMode && product.transactionMode !== 'sell')) {
      throw new AppError('Sản phẩm không khả dụng để mua', HTTP_STATUS.BAD_REQUEST, 'PRODUCT_NOT_CHECKOUTABLE')
    }
    if (String(product.owner) === String(buyerId)) {
      throw new AppError('Không thể mua sản phẩm của chính bạn', HTTP_STATUS.BAD_REQUEST, 'SELF_ORDER_NOT_ALLOWED')
    }
    if (product.shop && !activeShopIds.has(String(product.shop))) {
      throw new AppError('Shop hiện không hoạt động', HTTP_STATUS.CONFLICT, 'SHOP_NOT_ACTIVE')
    }

    const variants = (product.variants || []).filter((variant) => variant.isActive)
    const variant = requested.variantId
      ? variants.find((item) => String(item._id) === String(requested.variantId))
      : variants.length === 1 ? variants[0] : null
    if (!variant) {
      throw new AppError('Vui lòng chọn đúng phiên bản sản phẩm', HTTP_STATUS.BAD_REQUEST, 'VARIANT_REQUIRED')
    }

    const quantity = Number(requested.quantity)
    const unitPrice = Number(variant.price)
    return {
      product: product._id,
      variantId: variant._id,
      sku: variant.sku,
      title: product.title,
      image: product.images?.find((image) => image.isPrimary)?.url || product.images?.[0]?.url || '',
      attributes: mapAttributes(variant.attributes),
      quantity,
      unitPrice,
      subtotal: unitPrice * quantity,
      shop: product.shop || null,
      seller: product.seller || null,
    }
  })
}

const groupItemsByMerchant = (items) => {
  const groups = new Map()
  for (const item of items) {
    const key = item.shop ? `shop:${item.shop}` : `seller:${item.seller}`
    groups.set(key, [...(groups.get(key) || []), item])
  }
  return [...groups.values()]
}

const createCheckoutCommand = async ({ buyerId, idempotencyKey, items, shippingAddress, cartId = null, cartProductIds = [] }) => {
  const existing = await Checkout.findOne({ buyer: buyerId, idempotencyKey }).populate('orders')
  if (existing) return existing

  const normalizedItems = await loadCheckoutItems(items, buyerId)
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000)

  const checkoutId = await runRequiredMongoTransaction(async (session) => {
    const [checkout] = await Checkout.create([{
      buyer: buyerId,
      idempotencyKey,
      items: normalizedItems,
      shippingAddress,
      amount: { subtotal, discount: 0, shippingFee: 0, tax: 0, total: subtotal },
      status: CHECKOUT_STATUS.PAYMENT_PENDING,
      expiresAt,
    }], { session })

    const reservations = []
    for (const item of normalizedItems) {
      reservations.push(await reserveVariant({
        checkoutId: checkout._id,
        productId: item.product,
        variantId: item.variantId,
        sku: item.sku,
        quantity: item.quantity,
        expiresAt,
      }, session))
    }

    const orders = []
    for (const merchantItems of groupItemsByMerchant(normalizedItems)) {
      const orderSubtotal = merchantItems.reduce((sum, item) => sum + item.subtotal, 0)
      const firstItem = merchantItems[0]
      const [order] = await Order.create([{
        buyer: buyerId,
        checkout: checkout._id,
        shop: firstItem.shop,
        seller: firstItem.seller,
        product: firstItem.product,
        quantity: merchantItems.reduce((sum, item) => sum + item.quantity, 0),
        unitPrice: firstItem.unitPrice,
        totalAmount: orderSubtotal,
        grossAmount: orderSubtotal,
        netSettlementAmount: orderSubtotal,
        items: merchantItems,
        amountBreakdown: { subtotal: orderSubtotal, discount: 0, shippingFee: 0, tax: 0, total: orderSubtotal },
        shippingAddress,
        status: ORDER_STATUS.PENDING,
        commerceStatus: COMMERCE_ORDER_STATUS.PAYMENT_PENDING,
        paymentStatus: PAYMENT_STATUS.UNPAID,
        history: [{ status: ORDER_STATUS.PENDING, note: 'Tạo đơn hàng từ checkout API v1', updatedBy: buyerId }],
      }], { session })
      orders.push(order)
    }

    const orderByMerchant = new Map(orders.map((order) => [order.shop ? `shop:${order.shop}` : `seller:${order.seller}`, order]))
    for (const reservation of reservations) {
      const item = normalizedItems.find((value) => String(value.product) === String(reservation.product) && String(value.variantId) === String(reservation.variantId))
      const key = item.shop ? `shop:${item.shop}` : `seller:${item.seller}`
      reservation.order = orderByMerchant.get(key)._id
      await reservation.save({ session })
    }

    checkout.orders = orders.map((order) => order._id)
    checkout.reservations = reservations.map((reservation) => reservation._id)
    await checkout.save({ session })
    await JobLease.create([{
      jobKey: `checkout-expiry:${checkout._id}`,
      jobType: 'checkout_expiry',
      payload: { checkoutId: checkout._id },
      runAt: expiresAt,
    }], { session })
    if (cartId && cartProductIds.length) {
      await Cart.updateOne(
        { _id: cartId, user: buyerId },
        { $pull: { items: { product: { $in: cartProductIds } } } },
        { session }
      )
    }
    return checkout._id
  })

  return Checkout.findById(checkoutId).populate('orders').populate('reservations')
}

export const createCheckout = async (command) => {
  const loadResource = (resourceId) => Checkout.findById(resourceId).populate('orders').populate('reservations')
  return runIdempotentCommand({
    commandKey: `checkout:${command.buyerId}:${command.idempotencyKey}`,
    resourceType: 'Checkout',
    loadResource,
    execute: () => createCheckoutCommand(command),
  })
}

export const getCheckout = async (checkoutId, buyerId) => {
  const checkout = await Checkout.findOne({ _id: checkoutId, buyer: buyerId })
    .populate('orders')
    .populate('reservations')
  if (!checkout) {
    throw new AppError('Không tìm thấy checkout', HTTP_STATUS.NOT_FOUND, 'CHECKOUT_NOT_FOUND')
  }
  return checkout
}
