import Category from '../../src/models/category.model.js'
import Order from '../../src/models/order.model.js'
import Product, { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import Shop from '../../src/models/shop.model.js'
import { ORDER_STATUS, PAYMENT_STATUS, SHOP_STATUS } from '../../src/constants/status.constant.js'
import { createTestUser } from './auth.js'

const uniqueSlug = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const createSampleCategory = (overrides = {}) =>
  Category.create({
    name: overrides.name || 'Test Decor',
    slug: overrides.slug || uniqueSlug('test-decor'),
    ...overrides,
  })

export const createSampleShop = async (overrides = {}) => {
  const owner = overrides.owner || (await createTestUser({ roles: ['shop_owner'] }))._id

  return Shop.create({
    name: overrides.name || 'Test Shop',
    slug: overrides.slug || uniqueSlug('test-shop'),
    owner,
    status: overrides.status || SHOP_STATUS.ACTIVE,
    ...overrides,
  })
}

export const createSampleProduct = async (overrides = {}) => {
  const category = overrides.category || (await createSampleCategory())._id
  const createdShop = overrides.shop ? null : await createSampleShop()
  const shop = overrides.shop || createdShop._id
  const owner = overrides.owner || overrides.seller || overrides.shopOwner || createdShop?.owner

  return Product.create({
    title: overrides.title || 'Test Product',
    description: overrides.description || 'Reusable test product fixture.',
    price: overrides.price ?? 100000,
    stock: overrides.stock ?? 10,
    listingType: overrides.listingType || 'sell',
    condition: overrides.condition || 'new',
    category,
    shop,
    seller: overrides.seller || null,
    owner: owner || shop,
    ownerType: overrides.ownerType || PRODUCT_OWNER_TYPES.SHOP,
    images: overrides.images || [{ url: 'https://example.com/test.png', publicId: 'test-product' }],
    location: overrides.location || { province: 'Test Province', district: 'Test District' },
    ...overrides,
  })
}

export const createSampleOrder = async (overrides = {}) => {
  const buyer = overrides.buyer || (await createTestUser())._id
  const product = overrides.product || (await createSampleProduct())
  const quantity = overrides.quantity || 1
  const unitPrice = overrides.unitPrice ?? product.price

  return Order.create({
    buyer,
    shop: overrides.shop ?? product.shop,
    seller: overrides.seller ?? product.seller,
    product: product._id || product,
    quantity,
    unitPrice,
    totalAmount: overrides.totalAmount ?? unitPrice * quantity,
    status: overrides.status || ORDER_STATUS.PENDING,
    paymentStatus: overrides.paymentStatus || PAYMENT_STATUS.UNPAID,
    shippingAddress: overrides.shippingAddress || {
      province: 'Test Province',
      district: 'Test District',
      detail: 'Test Address',
    },
    history: overrides.history || [{ status: ORDER_STATUS.PENDING, updatedBy: buyer, note: 'Created by test factory' }],
    ...overrides,
  })
}
