/* eslint-env jest */
import request from 'supertest'
import app from '../../src/server.js'
import User from '../../src/models/user.model.js'
import Product from '../../src/models/product.model.js'
import Category from '../../src/models/category.model.js'
import Shop from '../../src/models/shop.model.js'
import Cart from '../../src/models/cart.model.js'
import { createToken } from './fixtures/testData.js'
import { SHOP_STATUS } from '../../src/constants/status.constant.js'

let buyer
let owner
let category
let shop
let token

const createCartProduct = (overrides = {}) =>
  Product.create({
    title: 'Cart decor product',
    description: 'A decor product used for cart CRUD integration tests.',
    price: 250000,
    stock: 5,
    listingType: 'sell',
    condition: 'new',
    category: category._id,
    owner: owner._id,
    shop: shop._id,
    ...overrides,
  })

describe('Cart CRUD APIs', () => {
  beforeEach(async () => {
    await Promise.all([
      Cart.deleteMany({}),
      Product.deleteMany({}),
      Shop.deleteMany({}),
      Category.deleteMany({}),
      User.deleteMany({}),
    ])

    buyer = await User.create({ name: 'Cart Buyer', email: 'cart-buyer@example.com', password: '123456' })
    owner = await User.create({
      name: 'Cart Owner',
      email: 'cart-owner@example.com',
      password: '123456',
      roles: ['shop_owner'],
    })
    category = await Category.create({ name: 'Cart Decor', slug: 'cart-decor' })
    shop = await Shop.create({ name: 'Cart Shop', slug: 'cart-shop', owner: owner._id, status: SHOP_STATUS.ACTIVE })
    token = await createToken(buyer._id)
  })

  it('returns 401 when getting cart without login', async () => {
    const res = await request(app).get('/api/v1/cart')

    expect(res.statusCode).toBe(401)
  })

  it('returns an empty cart on first authenticated request', async () => {
    const res = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.cart.items).toEqual([])
    expect(res.body.data.cart.totalItems).toBe(0)
    expect(res.body.data.cart.totalAmount).toBe(0)
    expect(await Cart.findOne({ user: buyer._id })).not.toBeNull()
  })

  it('adds a product and stores the current database price', async () => {
    const product = await createCartProduct({ price: 321000 })

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 })

    expect(res.statusCode).toBe(200)
    expect(res.body.data.cart.items).toHaveLength(1)
    expect(res.body.data.cart.items[0].quantity).toBe(2)
    expect(res.body.data.cart.items[0].unitPrice).toBe(321000)
    expect(res.body.data.cart.totalItems).toBe(2)
    expect(res.body.data.cart.totalAmount).toBe(642000)
  })

  it('adds the same product twice by increasing quantity', async () => {
    const product = await createCartProduct({ stock: 5 })

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 })

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 })

    expect(res.statusCode).toBe(200)
    expect(res.body.data.cart.items).toHaveLength(1)
    expect(res.body.data.cart.items[0].quantity).toBe(3)
  })

  it('returns an error when adding quantity beyond stock', async () => {
    const product = await createCartProduct({ stock: 2 })

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 3 })

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Product does not have enough stock')
  })

  it('updates item quantity without changing unit price', async () => {
    const product = await createCartProduct({ price: 111000, stock: 5 })

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 })
    await Product.findByIdAndUpdate(product._id, { price: 999000 })

    const res = await request(app)
      .patch(`/api/v1/cart/items/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3 })

    expect(res.statusCode).toBe(200)
    expect(res.body.data.cart.items[0].quantity).toBe(3)
    expect(res.body.data.cart.items[0].unitPrice).toBe(111000)
  })

  it('returns an error when updating quantity beyond stock', async () => {
    const product = await createCartProduct({ stock: 2 })

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 })

    const res = await request(app)
      .patch(`/api/v1/cart/items/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3 })

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('Product does not have enough stock')
  })

  it('removes an item from cart', async () => {
    const product = await createCartProduct()

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1 })

    const res = await request(app)
      .delete(`/api/v1/cart/items/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.cart.items).toEqual([])
    expect(res.body.data.cart.totalItems).toBe(0)
  })

  it('clears the cart', async () => {
    const product = await createCartProduct()

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 2 })

    const res = await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.cart.items).toEqual([])
    expect(res.body.data.cart.totalItems).toBe(0)
    expect(res.body.data.cart.totalAmount).toBe(0)
  })

  it('rejects invalid quantity values', async () => {
    const product = await createCartProduct()

    const zero = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 0 })
    const decimal = await request(app)
      .patch(`/api/v1/cart/items/${product._id.toString()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1.5 })

    expect(zero.statusCode).toBe(422)
    expect(decimal.statusCode).toBe(422)
  })
})

