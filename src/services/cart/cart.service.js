import mongoose from 'mongoose'
import Product from '../../models/product.model.js'
import Cart from '../../models/cart.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import ERRORS from '../../constants/error.constant.js'

const CART_PRODUCT_SELECT = 'title price stock status isActive images owner ownerType shop seller'

const assertObjectId = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError('ID sản phẩm không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_OBJECT_ID)
  }
}

const findOrCreateCart = async (userId) => {
  const cart = await Cart.findOne({ user: userId })
  if (cart) return cart

  return Cart.create({ user: userId, items: [] })
}

const populateCart = (cart) => cart.populate('items.product', CART_PRODUCT_SELECT)

export const calculateCartTotals = (cart) => {
  const items = cart?.items || []
  return items.reduce(
    (totals, item) => ({
      totalItems: totals.totalItems + Number(item.quantity || 0),
      totalAmount: totals.totalAmount + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    }),
    { totalItems: 0, totalAmount: 0 }
  )
}

const formatCart = (cart) => {
  const cartObject = typeof cart.toObject === 'function' ? cart.toObject() : cart
  return {
    ...cartObject,
    ...calculateCartTotals(cartObject),
  }
}

const getCartItem = (cart, productId) => cart.items.find((item) => item.product.toString() === productId)

const getCartItemIndex = (cart, productId) => cart.items.findIndex((item) => item.product.toString() === productId)

const getAvailableProduct = async (productId) => {
  assertObjectId(productId)

  const product = await Product.findById(productId)
  if (!product) {
    throw new AppError('Sản phẩm không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.CART.PRODUCT_NOT_FOUND)
  }

  if (!product.isActive || product.status !== 'available' || product.stock <= 0) {
    throw new AppError('Sản phẩm không còn được bán', HTTP_STATUS.BAD_REQUEST, ERRORS.CART.PRODUCT_UNAVAILABLE)
  }

  return product
}

const assertEnoughStock = (product, quantity) => {
  if (product.stock < quantity) {
    throw new AppError('Sản phẩm không đủ số lượng trong kho', HTTP_STATUS.BAD_REQUEST, ERRORS.CART.INSUFFICIENT_STOCK)
  }
}

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

export const getMyCart = async (userId) => {
  const cart = await findOrCreateCart(userId)
  await populateCart(cart)
  return formatCart(cart)
}

export const addItem = async (userId, productId, quantity) => {
  const product = await getAvailableProduct(productId)
  const cart = await findOrCreateCart(userId)
  const existingItem = getCartItem(cart, productId)
  const nextQuantity = (existingItem?.quantity || 0) + quantity

  assertEnoughStock(product, nextQuantity)

  if (existingItem) {
    existingItem.quantity = nextQuantity
  } else {
    cart.items.push({ product: product._id, quantity, unitPrice: product.price })
  }

  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const updateItem = async (userId, productId, quantity) => {
  assertObjectId(productId)

  const cart = await findOrCreateCart(userId)
  const item = getCartItem(cart, productId)
  if (!item) {
    throw new AppError('Sản phẩm không tồn tại trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.CART.ITEM_NOT_FOUND)
  }

  const product = await getAvailableProduct(productId)
  assertEnoughStock(product, quantity)

  item.quantity = quantity
  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const removeItem = async (userId, productId) => {
  assertObjectId(productId)

  const cart = await findOrCreateCart(userId)
  const itemIndex = getCartItemIndex(cart, productId)
  if (itemIndex === -1) {
    throw new AppError('Sản phẩm không tồn tại trong giỏ hàng', HTTP_STATUS.NOT_FOUND, ERRORS.CART.ITEM_NOT_FOUND)
  }

  cart.items.splice(itemIndex, 1)
  await cart.save()
  await populateCart(cart)
  return formatCart(cart)
}

export const clearCart = async (userId) => {
  const cart = await findOrCreateCart(userId)
  cart.items = []
  await cart.save()
  return formatCart(cart)
}

export const addCombo = async (userId, items) => {
  const mergedItems = mergeItems(items)
  const products = await Product.find({ _id: { $in: mergedItems.map((item) => item.productId) } })
  const productById = new Map(products.map((product) => [product._id.toString(), product]))
  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId, items: [] })
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
