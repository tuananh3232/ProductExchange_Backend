import Product from '../../models/product.model.js'
import Cart from '../../models/cart.model.js'

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
  await cart.populate('items.product', 'title price stock status isActive images')
  return { cart }
}
