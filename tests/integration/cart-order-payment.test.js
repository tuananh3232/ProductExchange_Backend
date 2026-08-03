import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginMember, loginSeller } from '../setup/auth.js'
import { createSampleProduct } from '../setup/factories.js'
import Cart from '../../src/models/cart.model.js'
import Order from '../../src/models/order.model.js'
import Payment from '../../src/models/payment.model.js'
import Product from '../../src/models/product.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
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

  it('does not let stale PayOS return release inventory for an order already paid by wallet', async () => {
    const { user, token } = await loginMember()
    const product = await createSampleProduct({ stock: 5, status: PRODUCT_STATUS.AVAILABLE })
    const orderResponse = await request(app)
      .post(`${api}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product._id.toString(), quantity: 1, shippingAddress })

    const orderId = orderResponse.body.data.order._id
    await Payment.create({
      order: orderId,
      buyer: user._id,
      amount: product.price,
      provider: 'payos',
      method: 'payos',
      status: PAYMENT_STATUS.PENDING_PAYMENT,
      transactionRef: 'PAYOS_123456789',
    })
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: PAYMENT_STATUS.PENDING_PAYMENT,
      paymentMethod: 'payos',
      paymentProvider: 'payos',
      paymentRef: 'PAYOS_123456789',
    })
    await UserWallet.create({ user: user._id, balance: 500000, totalTopUp: 500000 })

    const walletResponse = await request(app)
      .post(`${api}/user-wallet/me/pay-order`)
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId })

    expect(walletResponse.status).toBe(200)

    const payosReturnResponse = await request(app).get(`${api}/payments/payos/cancel`).query({
      code: '01',
      cancel: 'true',
      orderCode: 123456789,
    })

    const [freshOrder, freshProduct] = await Promise.all([
      Order.findById(orderId),
      Product.findById(product._id),
    ])

    expect(payosReturnResponse.status).toBe(200)
    expect(freshOrder.paymentStatus).toBe(PAYMENT_STATUS.PAID)
    expect(freshOrder.paymentMethod).toBe('wallet')
    expect(freshOrder.inventoryStatus).toBe('reserved')
    expect(freshProduct.stock).toBe(4)
  })

  it('rolls back reserved stock when wallet checkout fails for insufficient balance', async () => {
    const { user, token } = await loginMember()
    const product = await createSampleProduct({ stock: 5, status: PRODUCT_STATUS.AVAILABLE })

    await request(app)
      .post(`${api}/cart/add-combo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product._id.toString(), quantity: 2 }] })

    const checkoutResponse = await request(app)
      .post(`${api}/cart/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ selectedProductIds: [product._id.toString()], paymentMethod: 'WALLET' })

    const [freshProduct, orders] = await Promise.all([
      Product.findById(product._id),
      Order.find({ buyer: user._id, product: product._id }),
    ])

    expect(checkoutResponse.status).toBe(400)
    expect(freshProduct.stock).toBe(5)
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe(ORDER_STATUS.CANCELLED)
    expect(orders[0].inventoryStatus).toBe('released')
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

  it('hides out-of-stock products from public product listing', async () => {
    const outOfStockProduct = await createSampleProduct({ stock: 0, status: PRODUCT_STATUS.AVAILABLE })
    const availableProduct = await createSampleProduct({ stock: 2, status: PRODUCT_STATUS.AVAILABLE })

    const response = await request(app).get(`${api}/products`)
    const ids = response.body.data.products.map((product) => product._id.toString())

    expect(response.status).toBe(200)
    expect(ids).toContain(availableProduct._id.toString())
    expect(ids).not.toContain(outOfStockProduct._id.toString())
  })
})
