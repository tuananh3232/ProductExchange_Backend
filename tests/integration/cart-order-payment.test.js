import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginMember, loginSeller } from '../setup/auth.js'
import { createSampleProduct } from '../setup/factories.js'
import Cart from '../../src/models/cart.model.js'
import Product from '../../src/models/product.model.js'
import { ORDER_STATUS, PAYMENT_STATUS, PRODUCT_STATUS } from '../../src/constants/status.constant.js'

const api = env.apiPrefix

const shippingAddress = {
  province: 'Test Province',
  district: 'Test District',
  detail: '123 Test Street',
}

beforeEach(async () => {
  await resetTestDatabase()
})

describe('cart, order, and payment integration', () => {
  it('adds an available product to the cart through the active cart endpoint', async () => {
    const { user, token } = await loginMember()
    const product = await createSampleProduct({ stock: 5, status: PRODUCT_STATUS.AVAILABLE })

    const response = await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] })

    const cart = await Cart.findOne({ user: user._id })

    expect(response.status).toBe(200)
    expect(response.body.data.cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(2)
  })

  it('updates cart quantity by merging an existing cart item through add-combo', async () => {
    const { user, token } = await loginMember()
    const product = await createSampleProduct({ stock: 5, status: PRODUCT_STATUS.AVAILABLE })

    await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 1 }] })

    const response = await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] })

    const cart = await Cart.findOne({ user: user._id })

    expect(response.status).toBe(200)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].quantity).toBe(3)
  })

  it('rejects unavailable products instead of adding them to cart', async () => {
    const { user, token } = await loginMember()
    const product = await createSampleProduct({ stock: 5, status: PRODUCT_STATUS.HIDDEN })

    const response = await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 1 }] })

    const cart = await Cart.findOne({ user: user._id })

    expect(response.status).toBe(400)
    expect(response.body.errors[0].reason).toBe('inactive')
    expect(cart).toBeNull()
  })

  it('rejects rental products in cart checkout and direct order creation', async () => {
    const [{ token }, { user: seller }] = await Promise.all([loginMember(), loginSeller()])
    const rentalProduct = await createSampleProduct({
      owner: seller._id,
      seller: seller._id,
      ownerType: 'SELLER',
      shop: null,
      transactionMode: 'rental',
      status: PRODUCT_STATUS.AVAILABLE,
      stock: 3,
    })

    const addToCartResponse = await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: rentalProduct._id.toString(), quantity: 1 }] })

    expect(addToCartResponse.status).toBe(200)

    const checkoutResponse = await request(app)
      .post(`${api}/cart/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedProductIds: [rentalProduct._id.toString()] })

    expect(checkoutResponse.status).toBe(400)

    const directOrderResponse = await request(app)
      .post(`${api}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: rentalProduct._id.toString(), quantity: 1, shippingAddress })

    expect(directOrderResponse.status).toBe(400)
  })

  it('creates an order for an available product and marks the product pending', async () => {
    const { token } = await loginMember()
    const product = await createSampleProduct({ status: PRODUCT_STATUS.AVAILABLE })

    const response = await request(app)
      .post(`${api}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1, shippingAddress })

    const updatedProduct = await Product.findById(product._id)

    expect(response.status).toBe(201)
    expect(response.body.data.order.status).toBe(ORDER_STATUS.PENDING)
    expect(updatedProduct.status).toBe(PRODUCT_STATUS.PENDING)
  })

  it('allows a buyer to cancel an order and restores the product availability', async () => {
    const { token } = await loginMember()
    const product = await createSampleProduct({ status: PRODUCT_STATUS.AVAILABLE })
    const orderResponse = await request(app)
      .post(`${api}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1, shippingAddress })

    const response = await request(app)
      .patch(`${api}/orders/${orderResponse.body.data.order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'Buyer changed mind' })

    const restoredProduct = await Product.findById(product._id)

    expect(response.status).toBe(200)
    expect(response.body.data.order.status).toBe(ORDER_STATUS.CANCELLED)
    expect(response.body.data.order.paymentStatus).toBe(PAYMENT_STATUS.UNPAID)
    expect(restoredProduct.status).toBe(PRODUCT_STATUS.AVAILABLE)
  })

  it('handles PayOS cancel callback without calling a real payment provider', async () => {
    const response = await request(app).get(`${api}/payments/payos/cancel`).query({
      code: '00',
      id: 'test-payment-link',
      cancel: 'true',
      status: 'CANCELLED',
      orderCode: 123456,
    })

    expect([200, 400, 404]).toContain(response.status)
    expect(response.status).not.toBe(500)
  })
})
