import crypto from 'crypto'
import Product from '../../models/product.model.js'
import Cart from '../../models/cart.model.js'
import User from '../../models/user.model.js'
import Order from '../../models/order.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS } from '../../constants/status.constant.js'
import * as orderService from '../order/order.service.js'
import * as paymentService from '../payment/payment.service.js'
import * as userWalletService from '../user-wallet/user-wallet.service.js'

const mergeItems = (items) => {
  const quantities = new Map()
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity)
  }
  return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }))
}

const getUnavailableReason = (product, quantity) => {
  if (!product) return 'product_not_found'
  if (!product.isActive || product.status !== 'available') return 'inactive'
  if (product.stock <= 0) return 'out_of_stock'
  if (product.stock < quantity) return 'insufficient_stock'
  return null
}

const productIdOf = (item) => item.product?._id?.toString?.() || item.product?.toString?.()

const formatCart = (cart) => {
  const items = (cart?.items || [])
    .filter((item) => item.product)
    .map((item) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || item.product?.price || 0)
      return {
        productId: productIdOf(item),
        product: item.product,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
      }
    })

  return {
    items,
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.subtotal, 0),
  }
}

const getOrCreateCart = async (userId) => (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] })

const populateCart = (cart) => cart.populate('items.product', 'title price stock status isActive images owner ownerType shop seller listingType')

const assertProductAvailableForQuantity = (product, quantity) => {
  const reason = getUnavailableReason(product, quantity)
  if (reason === 'product_not_found') {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }
  if (reason) {
    throw new AppError('Sản phẩm không còn khả dụng với số lượng yêu cầu', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.UNAVAILABLE)
  }
}

const assertProductCheckoutable = (product, quantity, userId) => {
  assertProductAvailableForQuantity(product, quantity)

  if (!['sell', 'both'].includes(product.listingType)) {
    throw new AppError('Sản phẩm này không hỗ trợ đặt mua', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_NOT_SELLABLE)
  }

  if (product.owner?.toString?.() === userId.toString()) {
    throw new AppError('Không thể đặt mua sản phẩm của chính bạn', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.SELF_ORDER_NOT_ALLOWED)
  }

  if (product.ownerType === 'SHOP' && !product.shop) {
    throw new AppError('Sản phẩm chưa gắn với shop', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_MISSING_SHOP)
  }

  if (product.ownerType === 'SELLER' && !product.seller) {
    throw new AppError('Sản phẩm chưa gắn với seller', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PRODUCT_MISSING_SHOP)
  }
}

export const addCombo = async (userId, items) => {
  const mergedItems = mergeItems(items)
  const products = await Product.find({ _id: { $in: mergedItems.map((item) => item.productId) } })
  const productById = new Map(products.map((product) => [product._id.toString(), product]))
  const cart = await getOrCreateCart(userId)
  const existingQuantities = new Map(cart.items.map((item) => [item.product.toString(), item.quantity]))

  const errors = mergedItems.flatMap(({ productId, quantity }) => {
    const product = productById.get(productId)
    const reason = getUnavailableReason(product, quantity + (existingQuantities.get(productId) || 0))
    return reason ? [{ productId, reason }] : []
  })
  if (errors.length) return { errors }

  for (const { productId, quantity } of mergedItems) {
    const product = productById.get(productId)
    const existingItem = cart.items.find((item) => item.product.toString() === productId)
    if (existingItem) {
      existingItem.quantity += quantity
      existingItem.unitPrice = product.price
    } else {
      cart.items.push({ product: product._id, quantity, unitPrice: product.price })
    }
  }

  await cart.save()
  await populateCart(cart)
  return { cart: formatCart(cart) }
}

export const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId)
  await populateCart(cart)
  return formatCart(cart)
}

export const updateCartItem = async (userId, productId, quantity) => {
  const cart = await getOrCreateCart(userId)
  const item = cart.items.find((cartItem) => cartItem.product.toString() === productId)
  if (!item) {
    throw new AppError('Sản phẩm không có trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const product = await Product.findById(productId).select('_id price stock status isActive')
  assertProductAvailableForQuantity(product, quantity)

  item.quantity = quantity
  item.unitPrice = product.price
  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const removeCartItem = async (userId, productId) => {
  const cart = await getOrCreateCart(userId)
  const originalLength = cart.items.length
  cart.items = cart.items.filter((item) => item.product.toString() !== productId)
  if (cart.items.length === originalLength) {
    throw new AppError('Sản phẩm không có trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const clearCart = async (userId) => {
  const cart = await getOrCreateCart(userId)
  cart.items = []
  await cart.save()
  return formatCart(cart)
}

const getCheckoutItems = (cart, selectedProductIds) => {
  const selectedSet = selectedProductIds?.length ? new Set(selectedProductIds.map(String)) : null
  const items = (cart.items || []).filter((item) => !selectedSet || selectedSet.has(item.product.toString()))

  if (!items.length) {
    throw new AppError('Giỏ hàng không có sản phẩm phù hợp để checkout', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  return items
}

const getShippingAddress = async (userId) => {
  const user = await User.findById(userId).select('address')
  return user?.address || {}
}

const createPaymentForSingleOrder = async (paymentMethod, orderId, userContext, req) => {
  if (!paymentMethod) return { paymentUrl: null, payment: null }

  if (paymentMethod === 'PAYOS') {
    return paymentService.createPayosPayment(orderId, userContext)
  }

  if (paymentMethod === 'VNPAY') {
    return paymentService.createVnpayPayment(orderId, userContext, req)
  }

  if (paymentMethod === 'WALLET') {
    const walletResult = await userWalletService.payOrderWithWallet(orderId, userContext)
    return { paymentUrl: null, payment: walletResult.transaction }
  }

  return { paymentUrl: null, payment: null }
}

const toCheckoutOrder = (order) => ({
  id: order._id?.toString?.() || order.id,
  status: order.status,
  paymentStatus: order.paymentStatus,
  totalAmount: order.totalAmount,
  productId: order.product?._id?.toString?.() || order.product?.toString?.(),
})

export const checkoutCart = async (userId, payload = {}, userContext, req) => {
  const cart = await getOrCreateCart(userId)
  if (!cart.items.length) {
    throw new AppError('Gio hang dang trong', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const checkoutItems = getCheckoutItems(cart, payload.selectedProductIds)
  const productIds = checkoutItems.map((item) => item.product.toString())
  const products = await Product.find({ _id: { $in: productIds } }).select('_id price stock status isActive owner ownerType shop seller listingType')
  const productById = new Map(products.map((product) => [product._id.toString(), product]))

  for (const item of checkoutItems) {
    const product = productById.get(item.product.toString())
    assertProductCheckoutable(product, item.quantity, userId)
  }

  const shippingAddress = await getShippingAddress(userId)
  const createdOrders = []
  for (const item of checkoutItems) {
    const order = await orderService.createOrder(userId, {
      productId: item.product.toString(),
      quantity: item.quantity,
      shippingAddress,
      note: '',
    })
    createdOrders.push(order)
  }

  let paymentUrl = null
  let payment = null
  const paymentMethod = payload.paymentMethod?.toUpperCase?.()

  if (paymentMethod && createdOrders.length === 1) {
    const paymentResult = await createPaymentForSingleOrder(paymentMethod, createdOrders[0]._id, userContext, req)
    paymentUrl = paymentResult.paymentUrl || null
    payment = paymentResult.payment || null
    if (paymentMethod === 'WALLET') {
      createdOrders[0].paymentStatus = PAYMENT_STATUS.PAID
    }
  }

  if (paymentMethod && createdOrders.length > 1) {
    await Promise.all(
      createdOrders.map((order) =>
        Order.findByIdAndUpdate(order._id, {
          paymentMethod: paymentMethod.toLowerCase(),
          paymentProvider: paymentMethod.toLowerCase(),
          paymentStatus: PAYMENT_STATUS.PENDING_PAYMENT,
        })
      )
    )
    createdOrders.forEach((order) => {
      order.paymentMethod = paymentMethod.toLowerCase()
      order.paymentProvider = paymentMethod.toLowerCase()
      order.paymentStatus = PAYMENT_STATUS.PENDING_PAYMENT
    })
  }

  const checkedOutProductIds = new Set(productIds)
  cart.items = cart.items.filter((item) => !checkedOutProductIds.has(item.product.toString()))
  await cart.save()
  await populateCart(cart)

  return {
    checkoutId: `chk_${crypto.randomUUID()}`,
    orders: createdOrders.map(toCheckoutOrder),
    paymentUrl,
    payment,
    cart: formatCart(cart),
    summary: {
      totalItems: checkoutItems.reduce((total, item) => total + item.quantity, 0),
      subtotal: checkoutItems.reduce((total, item) => {
        const product = productById.get(item.product.toString())
        return total + Number(product.price) * Number(item.quantity)
      }, 0),
      status: createdOrders.every((order) => order.status === ORDER_STATUS.PENDING) ? ORDER_STATUS.PENDING : null,
    },
  }
}
