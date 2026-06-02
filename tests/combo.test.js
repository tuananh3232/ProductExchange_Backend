/* eslint-env jest */
import request from 'supertest'
import app from '../src/server.js'
import User from '../src/models/user.model.js'
import Product from '../src/models/product.model.js'
import Category from '../src/models/category.model.js'
import Shop from '../src/models/shop.model.js'
import Cart from '../src/models/cart.model.js'
import { createToken } from './fixtures/testData.js'
import { SHOP_STATUS } from '../src/constants/status.constant.js'

let buyer
let owner
let category
let shop
let token

const createDecorProduct = (overrides = {}) =>
  Product.create({
    title: 'Minimalist decor product',
    description: 'A suitable decor product used for combo recommendation integration tests.',
    price: 200000,
    stock: 10,
    listingType: 'sell',
    condition: 'new',
    category: category._id,
    owner: owner._id,
    shop: shop._id,
    style: 'minimalist',
    roomType: 'bedroom',
    colorTone: 'warm',
    decorRole: 'lighting',
    comboPriority: 5,
    ...overrides,
  })

describe('Combo recommendation and cart APIs', () => {
  beforeEach(async () => {
    await Promise.all([
      Cart.deleteMany({}),
      Product.deleteMany({}),
      Shop.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ])
    buyer = await User.create({ name: 'Combo Buyer', email: 'combo-buyer@example.com', password: '123456' })
    owner = await User.create({ name: 'Combo Owner', email: 'combo-owner@example.com', password: '123456', roles: ['shop_owner'] })
    category = await Category.create({ name: 'Combo Decor', slug: 'combo-decor' })
    shop = await Shop.create({ name: 'Combo Shop', slug: 'combo-shop', owner: owner._id, status: SHOP_STATUS.ACTIVE })
    token = await createToken(buyer._id)
  })

  describe('POST /api/v1/combos/generate', () => {
    it('generates budget-safe combos with diverse roles and low-stock status', async () => {
      await Promise.all([
        createDecorProduct({ title: 'Main item', decorRole: 'main_item', price: 500000 }),
        createDecorProduct({ title: 'Lighting item', decorRole: 'lighting', price: 250000, stock: 5 }),
        createDecorProduct({ title: 'Wall item', decorRole: 'wall_decor', price: 200000 }),
        createDecorProduct({ title: 'Textile item', decorRole: 'textile', price: 150000 }),
        createDecorProduct({ title: 'Inactive accent', decorRole: 'accent_item', isActive: false }),
        createDecorProduct({ title: 'Out of stock accent', decorRole: 'accent_item', stock: 0 }),
      ])

      const res = await request(app).post('/api/v1/combos/generate').send({
        style: 'minimalist',
        roomType: 'bedroom',
        colorTone: 'warm',
        budget: 1500000,
        maxItems: 5,
      })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.combos).toHaveLength(3)
      for (const combo of res.body.data.combos) {
        expect(combo.totalPrice).toBeLessThanOrEqual(combo.targetBudget)
        expect(combo.products.every((product) => product.title !== 'Inactive accent')).toBe(true)
        expect(combo.products.every((product) => product.title !== 'Out of stock accent')).toBe(true)
      }
      const allProducts = res.body.data.combos.flatMap((combo) => combo.products)
      expect(allProducts.find((product) => product.title === 'Lighting item').availabilityStatus).toBe('low_stock')
      expect(new Set(res.body.data.combos[2].products.map((product) => product.decorRole)).size).toBeGreaterThan(1)
    })

    it.each([
      [{ budget: 0 }, 'budget'],
      [{ style: 'minimalist', roomType: 'bedroom' }, 'budget'],
      [{ budget: 1000000, maxItems: 1 }, 'maxItems'],
      [{ budget: 1000000, style: 'industrial' }, 'style'],
    ])('rejects invalid payload %o', async (payload, field) => {
      const res = await request(app).post('/api/v1/combos/generate').send(payload)
      expect(res.statusCode).toBe(422)
      expect(res.body.details.some((detail) => detail.field === field)).toBe(true)
    })

    it('returns an empty combo list when no suitable product exists', async () => {
      await createDecorProduct({ style: 'modern' })
      const res = await request(app).post('/api/v1/combos/generate').send({ style: 'minimalist', budget: 1000000 })
      expect(res.statusCode).toBe(200)
      expect(res.body.data.combos).toEqual([])
    })
  })

  describe('GET /api/v1/combos/alternatives', () => {
    it('filters unavailable and excluded products, applies maxPrice, and ranks matching products first', async () => {
      const excluded = await createDecorProduct({ title: 'Excluded lighting', comboPriority: 50 })
      await createDecorProduct({ title: 'Matching lighting', price: 300000, comboPriority: 1 })
      await createDecorProduct({ title: 'Different style lighting', style: 'modern', price: 100000, comboPriority: 1 })
      await createDecorProduct({ title: 'Expensive lighting', price: 900000 })
      await createDecorProduct({ title: 'Inactive lighting', isActive: false })
      await createDecorProduct({ title: 'Empty lighting', stock: 0 })

      const res = await request(app).get('/api/v1/combos/alternatives').query({
        decorRole: 'lighting',
        style: 'minimalist',
        roomType: 'bedroom',
        colorTone: 'warm',
        maxPrice: 500000,
        excludeProductIds: excluded._id.toString(),
      })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.alternatives.map((product) => product.title)).toEqual([
        'Matching lighting',
        'Different style lighting',
      ])
    })

    it('rejects an invalid decor role', async () => {
      const res = await request(app).get('/api/v1/combos/alternatives').query({ decorRole: 'table' })
      expect(res.statusCode).toBe(422)
    })

    it('rejects a missing decor role', async () => {
      const res = await request(app).get('/api/v1/combos/alternatives').query({ style: 'minimalist' })
      expect(res.statusCode).toBe(422)
    })

    it('returns an empty list when no alternative exists', async () => {
      const res = await request(app).get('/api/v1/combos/alternatives').query({
        decorRole: 'fragrance',
        style: 'luxury',
        roomType: 'kitchen',
        colorTone: 'dark',
        maxPrice: 1000,
      })
      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.alternatives).toEqual([])
    })
  })

  describe('POST /api/v1/cart/add-combo', () => {
    it('adds all items and stores current database prices instead of frontend prices', async () => {
      const product = await createDecorProduct({ title: 'First cart item', price: 321000 })
      const secondProduct = await createDecorProduct({ title: 'Second cart item', price: 123000 })
      const res = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: product._id.toString(), quantity: 2, price: 1 },
            { productId: secondProduct._id.toString(), quantity: 1 },
          ],
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.cart.items).toHaveLength(2)
      expect(res.body.data.cart.items[0].unitPrice).toBe(321000)
      expect(res.body.data.cart.items[0].quantity).toBe(2)
    })

    it('requires login and rejects an empty items array', async () => {
      const unauthorized = await request(app).post('/api/v1/cart/add-combo').send({ items: [] })
      expect(unauthorized.statusCode).toBe(401)

      const invalid = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] })
      expect(invalid.statusCode).toBe(422)
    })

    it('rejects non-positive quantity', async () => {
      const product = await createDecorProduct()
      const res = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId: product._id.toString(), quantity: 0 }] })
      expect(res.statusCode).toBe(422)
    })

    it('merges duplicate items before storing the cart', async () => {
      const product = await createDecorProduct()
      const res = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: product._id.toString(), quantity: 1 },
            { productId: product._id.toString(), quantity: 2 },
          ],
        })
      expect(res.statusCode).toBe(200)
      expect(res.body.data.cart.items).toHaveLength(1)
      expect(res.body.data.cart.items[0].quantity).toBe(3)
    })

    it('returns product errors and does not partially update cart', async () => {
      const validProduct = await createDecorProduct({ title: 'Valid cart item' })
      const emptyProduct = await createDecorProduct({ title: 'Empty cart item', stock: 0 })

      const res = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: validProduct._id.toString(), quantity: 1 },
            { productId: emptyProduct._id.toString(), quantity: 1 },
          ],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.errors).toEqual([{ productId: emptyProduct._id.toString(), reason: 'out_of_stock' }])
      expect(await Cart.findOne({ user: buyer._id })).toBeNull()
    })

    it('reports missing, inactive, and insufficient-stock products', async () => {
      const inactiveProduct = await createDecorProduct({ isActive: false })
      const limitedProduct = await createDecorProduct({ stock: 1 })
      const missingId = new Product()._id.toString()

      const res = await request(app)
        .post('/api/v1/cart/add-combo')
        .set('Authorization', `Bearer ${token}`)
        .send({
          items: [
            { productId: missingId, quantity: 1 },
            { productId: inactiveProduct._id.toString(), quantity: 1 },
            { productId: limitedProduct._id.toString(), quantity: 2 },
          ],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.errors).toEqual([
        { productId: missingId, reason: 'product_not_found' },
        { productId: inactiveProduct._id.toString(), reason: 'inactive' },
        { productId: limitedProduct._id.toString(), reason: 'insufficient_stock' },
      ])
    })
  })
})
