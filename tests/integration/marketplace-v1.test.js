import request from 'supertest'
import app from '../../src/server.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createUserWithToken } from '../setup/auth.js'
import { createSampleProduct } from '../setup/factories.js'
import Checkout from '../../src/models/checkout.model.js'
import PaymentAttempt from '../../src/models/payment-attempt.model.js'
import Product from '../../src/models/product.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import AccountingEntry from '../../src/models/accounting-entry.model.js'
import { runLocalReconciliation } from '../../src/services/accounting/reconciliation.service.js'
import crypto from 'crypto'
import { env } from '../../src/configs/env.config.js'

const api = '/api/v1'
const shippingAddress = {
  recipientName: 'Nguyễn Văn A',
  phone: '0901234567',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  detail: '123 Đường Kiểm Thử',
}

beforeEach(async () => resetTestDatabase())

const signVnpay = (payload) => {
  const query = Object.entries(payload)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return crypto.createHmac('sha512', env.payment.vnpay.hashSecret).update(Buffer.from(query, 'utf8')).digest('hex')
}

describe('marketplace API v1 money and inventory safety', () => {
  it('prevents overselling when two buyers checkout the last SKU concurrently', async () => {
    const [{ token: firstToken }, { token: secondToken }] = await Promise.all([
      createUserWithToken(),
      createUserWithToken(),
    ])
    const product = await createSampleProduct({
      stock: 1,
      variants: [{ sku: 'CONCURRENT-LAST-1', price: 125000, stockOnHand: 1, reservedStock: 0, isActive: true }],
    })
    const variantId = product.variants[0]._id.toString()
    const checkout = (token, key) => request(app)
      .post(`${api}/checkouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send({ items: [{ productId: product._id.toString(), variantId, quantity: 1 }], shippingAddress })

    const responses = await Promise.all([
      checkout(firstToken, 'concurrent-checkout-a'),
      checkout(secondToken, 'concurrent-checkout-b'),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409])
    expect(await Checkout.countDocuments()).toBe(1)
    const savedProduct = await Product.findById(product._id)
    expect(savedProduct.variants[0].reservedStock).toBe(1)
    expect(savedProduct.variants[0].stockOnHand).toBe(1)
  })

  it('returns one checkout for concurrent retries with the same idempotency key', async () => {
    const { token } = await createUserWithToken()
    const product = await createSampleProduct({
      stock: 2,
      variants: [{ sku: 'IDEMPOTENT-CHECKOUT-1', price: 75000, stockOnHand: 2, reservedStock: 0, isActive: true }],
    })
    const create = () => request(app)
      .post(`${api}/checkouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'same-concurrent-checkout-key')
      .send({
        items: [{ productId: product._id.toString(), variantId: product.variants[0]._id.toString(), quantity: 1 }],
        shippingAddress,
      })

    const responses = await Promise.all([create(), create()])
    expect(responses.map((response) => response.status)).toEqual([201, 201])
    expect(responses[0].body.data.checkout._id).toBe(responses[1].body.data.checkout._id)
    expect(await Checkout.countDocuments()).toBe(1)
    const savedProduct = await Product.findById(product._id)
    expect(savedProduct.variants[0].reservedStock).toBe(1)
  })

  it('keeps a payment pending when a forged PayOS return claims success', async () => {
    const { user } = await createUserWithToken()
    const checkout = await Checkout.create({
      buyer: user._id,
      idempotencyKey: 'return-security-checkout',
      items: [],
      orders: [],
      reservations: [],
      shippingAddress,
      amount: { subtotal: 100000, discount: 0, shippingFee: 0, tax: 0, total: 100000 },
      status: 'payment_pending',
      expiresAt: new Date(Date.now() + 60000),
    })
    const payment = await PaymentAttempt.create({
      checkout: checkout._id,
      orders: [],
      buyer: user._id,
      provider: 'payos',
      method: 'payos',
      amount: 100000,
      idempotencyKey: 'return-security-payment',
      merchantReference: 'PAYOS-99887766',
      providerOrderCode: 99887766,
      status: 'pending',
    })

    const response = await request(app).get(`${api}/payments/payos/return?orderCode=99887766&code=00&status=PAID`)
    expect(response.status).toBe(200)
    expect(response.body.data.result.status).toBe('pending')
    expect((await PaymentAttempt.findById(payment._id)).status).toBe('pending')
  })

  it('rejects an unsigned PayOS webhook', async () => {
    const response = await request(app)
      .post(`${api}/payments/payos/webhook`)
      .send({ code: '00', data: { orderCode: 123, amount: 100000 } })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('INVALID_PAYOS_SIGNATURE')
  })

  it('keeps VNPay return read-only and captures a signed IPN exactly once', async () => {
    const { user } = await createUserWithToken()
    const checkout = await Checkout.create({
      buyer: user._id,
      idempotencyKey: 'vnpay-checkout-security',
      items: [],
      orders: [],
      reservations: [],
      shippingAddress,
      amount: { subtotal: 120000, discount: 0, shippingFee: 0, tax: 0, total: 120000 },
      status: 'payment_pending',
      expiresAt: new Date(Date.now() + 60000),
    })
    const payment = await PaymentAttempt.create({
      checkout: checkout._id,
      orders: [],
      buyer: user._id,
      provider: 'vnpay',
      method: 'vnpay',
      amount: 120000,
      idempotencyKey: 'vnpay-payment-security',
      merchantReference: 'VNPAY-SECURITY-001',
      status: 'pending',
    })
    const payload = {
      vnp_Amount: '12000000',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: '778899',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: payment.merchantReference,
    }
    payload.vnp_SecureHash = signVnpay(payload)

    const returned = await request(app).get(`${api}/payments/vnpay/return`).query(payload)
    expect(returned.status).toBe(200)
    expect((await PaymentAttempt.findById(payment._id)).status).toBe('pending')

    const notify = () => request(app).post(`${api}/payments/vnpay/ipn`).send(payload)
    expect((await notify()).status).toBe(200)
    expect((await notify()).status).toBe(200)
    expect((await PaymentAttempt.findById(payment._id)).status).toBe('succeeded')
    expect(await AccountingEntry.countDocuments()).toBe(2)
  })

  it('captures wallet payment once and keeps the double-entry ledger balanced', async () => {
    const { user, token } = await createUserWithToken()
    const product = await createSampleProduct({
      variants: [{ sku: 'WALLET-CAPTURE-1', price: 90000, stockOnHand: 2, reservedStock: 0, isActive: true }],
    })
    await UserWallet.create({ user: user._id, balance: 200000 })
    const checkoutResponse = await request(app)
      .post(`${api}/checkouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'wallet-checkout-once')
      .send({
        items: [{ productId: product._id.toString(), variantId: product.variants[0]._id.toString(), quantity: 1 }],
        shippingAddress,
      })
    const checkoutId = checkoutResponse.body.data.checkout._id
    const pay = () => request(app)
      .post(`${api}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'wallet-payment-once')
      .send({ checkoutId, provider: 'wallet' })

    const first = await pay()
    const replay = await pay()
    expect(first.status).toBe(201)
    expect(replay.status).toBe(201)
    expect(replay.body.data.payment._id).toBe(first.body.data.payment._id)
    expect((await UserWallet.findOne({ user: user._id })).balance).toBe(110000)
    const entries = await AccountingEntry.find().lean()
    const debit = entries.filter((entry) => entry.direction === 'debit').reduce((sum, entry) => sum + entry.amount, 0)
    const credit = entries.filter((entry) => entry.direction === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
    expect(debit).toBe(90000)
    expect(credit).toBe(90000)
    const savedProduct = await Product.findById(product._id)
    expect(savedProduct.variants[0].stockOnHand).toBe(1)
    expect(savedProduct.variants[0].reservedStock).toBe(0)
    const reconciliation = await runLocalReconciliation()
    expect(reconciliation.result).toBe('matched')
    expect(reconciliation.ledgerDriftCount).toBe(0)
    expect(reconciliation.paymentChainIssueCount).toBe(0)
  })

  it('charges a wallet once for concurrent payment retries', async () => {
    const { user, token } = await createUserWithToken()
    const product = await createSampleProduct({
      variants: [{ sku: 'WALLET-CONCURRENT-1', price: 60000, stockOnHand: 2, reservedStock: 0, isActive: true }],
    })
    await UserWallet.create({ user: user._id, balance: 150000 })
    const checkoutResponse = await request(app)
      .post(`${api}/checkouts`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'wallet-concurrent-checkout')
      .send({
        items: [{ productId: product._id.toString(), variantId: product.variants[0]._id.toString(), quantity: 1 }],
        shippingAddress,
      })
    const checkoutId = checkoutResponse.body.data.checkout._id
    const pay = () => request(app)
      .post(`${api}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'wallet-concurrent-payment')
      .send({ checkoutId, provider: 'wallet' })

    const responses = await Promise.all([pay(), pay()])
    expect(responses.map((response) => response.status)).toEqual([201, 201])
    expect(responses[0].body.data.payment._id).toBe(responses[1].body.data.payment._id)
    expect(await PaymentAttempt.countDocuments()).toBe(1)
    expect((await UserWallet.findOne({ user: user._id })).balance).toBe(90000)
    expect(await AccountingEntry.countDocuments()).toBe(2)
  })

  it('rejects fake image content even when the MIME type claims PNG', async () => {
    const { token } = await createUserWithToken()
    const fakeImage = Buffer.from('this is not an image')
    const response = await request(app)
      .post('/api/v1/users/kyc')
      .set('Authorization', `Bearer ${token}`)
      .field('fullName', 'Nguyễn Văn Kiểm Thử')
      .field('idNumber', '012345678901')
      .attach('frontImage', fakeImage, { filename: 'front.png', contentType: 'image/png' })
      .attach('backImage', fakeImage, { filename: 'back.png', contentType: 'image/png' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('INVALID_IMAGE_CONTENT')
  })
})
