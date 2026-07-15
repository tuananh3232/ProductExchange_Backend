import Product from '../../models/product.model.js'
import Cart from '../../models/cart.model.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { createCheckout } from '../checkout/checkout.service.js'
import { createPaymentAttempt } from '../payment/payment-attempt.service.js'

const mergeItems = (items) => {
  const quantities = new Map()
  for (const item of items) {
    const key = `${item.productId}:${item.variantId || ''}`
    const current = quantities.get(key) || { ...item, quantity: 0 }
    current.quantity += item.quantity
    quantities.set(key, current)
  }
  return [...quantities.values()]
}

const resolveVariant = (product, variantId = null) => {
  const variants = (product?.variants || []).filter((variant) => variant.isActive)
  if (variantId) return variants.find((variant) => String(variant._id) === String(variantId)) || null
  return variants.length === 1 ? variants[0] : null
}

const getUnavailableReason = (product, quantity, variantId = null) => {
  if (!product) return 'product_not_found'
  if (!product.isActive || product.status !== 'available') return 'inactive'
  const variant = resolveVariant(product, variantId)
  if (!variant) return 'variant_required'
  const availableStock = Number(variant.stockOnHand) - Number(variant.reservedStock)
  if (availableStock <= 0) return 'out_of_stock'
  if (availableStock < quantity) return 'insufficient_stock'
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
        variantId: item.variantId,
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

const populateCart = (cart) =>
  cart.populate({
    path: 'items.product',
    select: 'title price stock variants status isActive images owner ownerType shop seller category listingType transactionMode',
    populate: [
      { path: 'shop', select: 'name' },
      { path: 'category', select: 'name' },
      { path: 'seller', select: 'name' },
      { path: 'owner', select: 'name' },
    ],
  })

const assertProductAvailableForQuantity = (product, quantity, variantId = null) => {
  const reason = getUnavailableReason(product, quantity, variantId)
  if (reason === 'product_not_found') {
    throw new AppError('Không tìm thấy sản phẩm', HTTP_STATUS.NOT_FOUND, ERRORS.PRODUCT.NOT_FOUND)
  }
  if (reason) {
    throw new AppError('Sản phẩm không còn khả dụng với số lượng yêu cầu', HTTP_STATUS.BAD_REQUEST, ERRORS.PRODUCT.UNAVAILABLE)
  }
}

const assertProductCheckoutable = (product, quantity, userId, variantId = null) => {
  assertProductAvailableForQuantity(product, quantity, variantId)

  if ((product.transactionMode || 'sell') !== 'sell') {
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
  const existingQuantities = new Map(cart.items.map((item) => [
    `${item.product}:${item.variantId || ''}`,
    item.quantity,
  ]))

  const errors = mergedItems.flatMap(({ productId, variantId, quantity }) => {
    const product = productById.get(productId)
    const resolvedVariant = resolveVariant(product, variantId)
    const key = `${productId}:${resolvedVariant?._id || variantId || ''}`
    const reason = getUnavailableReason(product, quantity + (existingQuantities.get(key) || 0), variantId)
    return reason ? [{ productId, variantId: variantId || null, reason }] : []
  })
  if (errors.length) return { errors }

  for (const { productId, variantId, quantity } of mergedItems) {
    const product = productById.get(productId)
    const variant = resolveVariant(product, variantId)
    const existingItem = cart.items.find((item) =>
      item.product.toString() === productId && String(item.variantId || '') === String(variant._id)
    )
    if (existingItem) {
      existingItem.quantity += quantity
      existingItem.unitPrice = variant.price
    } else {
      cart.items.push({ product: product._id, variantId: variant._id, quantity, unitPrice: variant.price })
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

const findCartLine = (cart, productId, variantId = null) => {
  const matches = cart.items.filter((cartItem) => cartItem.product.toString() === productId)
  if (variantId) return matches.find((cartItem) => String(cartItem.variantId || '') === String(variantId)) || null
  if (matches.length > 1) {
    throw new AppError('Vui lòng chọn đúng phiên bản sản phẩm', HTTP_STATUS.BAD_REQUEST, 'VARIANT_REQUIRED')
  }
  return matches[0] || null
}

export const updateCartItem = async (userId, productId, quantity, variantId = null) => {
  const cart = await getOrCreateCart(userId)
  const item = findCartLine(cart, productId, variantId)
  if (!item) {
    throw new AppError('Sản phẩm không có trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const product = await Product.findById(productId).select('_id price stock variants status isActive')
  assertProductAvailableForQuantity(product, quantity, item.variantId)

  item.quantity = quantity
  item.unitPrice = resolveVariant(product, item.variantId).price
  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const removeCartItem = async (userId, productId, variantId = null) => {
  const cart = await getOrCreateCart(userId)
  const originalLength = cart.items.length
  if (!findCartLine(cart, productId, variantId)) {
    throw new AppError('Sản phẩm không có trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  cart.items = cart.items.filter((item) => !(
    item.product.toString() === productId &&
    (!variantId || String(item.variantId || '') === String(variantId))
  ))
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

const getCheckoutItems = (cart, selectedProductIds, selectedItems) => {
  const selectedSet = selectedProductIds?.length ? new Set(selectedProductIds.map(String)) : null
  const selectedLineSet = selectedItems?.length
    ? new Set(selectedItems.map((item) => `${item.productId}:${item.variantId}`))
    : null
  const items = (cart.items || []).filter((item) => {
    const productId = item.product.toString()
    const lineKey = `${productId}:${String(item.variantId || '')}`
    return (!selectedSet && !selectedLineSet) || selectedSet?.has(productId) || selectedLineSet?.has(lineKey)
  })

  if (!items.length) {
    throw new AppError('Giỏ hàng không có sản phẩm phù hợp để checkout', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  return items
}

const getShippingAddress = async (userId) => {
  const user = await User.findById(userId).select('name phone address')
  const address = user?.address || {}
  if (!user?.name || !user?.phone || !address.province || !address.district || !address.detail) {
    throw new AppError(
      'Vui lòng cập nhật đầy đủ người nhận, số điện thoại và địa chỉ trước khi checkout',
      HTTP_STATUS.BAD_REQUEST,
      'SHIPPING_ADDRESS_INCOMPLETE'
    )
  }
  return {
    recipientName: user.name,
    phone: user.phone,
    province: address.province,
    district: address.district,
    detail: address.detail,
  }
}

export const checkoutCart = async (userId, payload = {}, _userContext, req) => {
  const cart = await getOrCreateCart(userId)
  if (!cart.items.length) {
    throw new AppError('Giỏ hàng đang trống', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const checkoutItems = getCheckoutItems(cart, payload.selectedProductIds, payload.selectedItems)
  const productIds = checkoutItems.map((item) => item.product.toString())
  const products = await Product.find({ _id: { $in: productIds } }).select('_id price stock variants status isActive owner ownerType shop seller listingType transactionMode')
  const productById = new Map(products.map((product) => [product._id.toString(), product]))

  for (const item of checkoutItems) {
    const product = productById.get(item.product.toString())
    assertProductCheckoutable(product, item.quantity, userId, item.variantId)
  }

  const shippingAddress = payload.shippingAddress || await getShippingAddress(userId)
  const idempotencyKey = req.get('idempotency-key')
  const checkout = await createCheckout({
    buyerId: userId,
    idempotencyKey,
    items: checkoutItems.map((item) => ({
      productId: item.product.toString(),
      variantId: item.variantId || undefined,
      quantity: item.quantity,
    })),
    shippingAddress,
    cartId: cart._id,
    cartProductIds: productIds,
    cartItemsToRemove: checkoutItems.map((item) => ({ product: item.product, variantId: item.variantId })),
  })

  const provider = payload.paymentMethod?.toLowerCase?.()
  const payment = provider
    ? await createPaymentAttempt({
      checkoutId: checkout._id,
      buyerId: userId,
      provider,
      idempotencyKey: `${idempotencyKey}:payment`,
      clientIp: '127.0.0.1',
    })
    : null

  const refreshedCart = await Cart.findById(cart._id)
  await populateCart(refreshedCart)
  return {
    checkoutId: checkout._id,
    orders: checkout.orders,
    paymentUrl: payment?.checkoutUrl || null,
    payment,
    reservationExpiresAt: checkout.expiresAt,
    cart: formatCart(refreshedCart),
    summary: {
      totalItems: checkoutItems.reduce((total, item) => total + item.quantity, 0),
      subtotal: checkout.amount.subtotal,
      status: checkout.status,
    },
  }
}
