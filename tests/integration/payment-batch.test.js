import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createUserWithToken } from '../setup/auth.js'
import { createSampleOrder } from '../setup/factories.js'
import { PAYMENT_STATUS, ORDER_STATUS } from '../../src/constants/status.constant.js'
import Order from '../../src/models/order.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletTransaction from '../../src/models/user-wallet-transaction.model.js'

const api = env.apiPrefix

beforeEach(async () => {
  await resetTestDatabase()
})

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const fundWallet = (userId, balance) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $set: { balance, totalTopUp: balance } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

const makeOrders = async (count = 2, amount = 100000) => {
  const { user, token } = await createUserWithToken()
  const orders = await Promise.all(
    Array.from({ length: count }, () =>
      createSampleOrder({ buyer: user._id, totalAmount: amount })
    )
  )
  return { user, token, orders }
}

const postPayOrders = (token, orderIds) =>
  request(app)
    .post(`${api}/user-wallet/me/pay-orders`)
    .set('Authorization', `Bearer ${token}`)
    .send({ orderIds })

// ─────────────────────────────────────────────
// Auth / Validation
// ─────────────────────────────────────────────

describe('POST /user-wallet/me/pay-orders — auth & validation', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post(`${api}/user-wallet/me/pay-orders`)
      .send({ orderIds: ['a'.repeat(24)] })
    expect(res.status).toBe(401)
  })

  it('returns 422 when orderIds is missing', async () => {
    const { token } = await createUserWithToken()
    const res = await request(app)
      .post(`${api}/user-wallet/me/pay-orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(422)
  })

  it('returns 422 when orderIds is empty', async () => {
    const { token } = await createUserWithToken()
    const res = await postPayOrders(token, [])
    expect(res.status).toBe(422)
  })

  it('returns 422 when orderIds exceeds 10 items', async () => {
    const { token } = await createUserWithToken()
    const ids = Array.from({ length: 11 }, () => 'a'.repeat(24))
    const res = await postPayOrders(token, ids)
    expect(res.status).toBe(422)
  })
})

// ─────────────────────────────────────────────
// Business Logic
// ─────────────────────────────────────────────

describe('POST /user-wallet/me/pay-orders — business logic', () => {
  it('returns 404 when one or more order IDs do not exist', async () => {
    const { user, token, orders } = await makeOrders(1)
    await fundWallet(user._id, 500000)
    const res = await postPayOrders(token, [orders[0]._id.toString(), 'a'.repeat(24)])
    expect(res.status).toBe(404)
  })

  it('returns 403 when caller is not the buyer', async () => {
    const { orders } = await makeOrders(2)
    const { user: other, token: otherToken } = await createUserWithToken()
    await fundWallet(other._id, 999999)
    const res = await postPayOrders(otherToken, orders.map(o => o._id.toString()))
    expect(res.status).toBe(403)
  })

  it('returns 400 when any order is not PENDING', async () => {
    const { user, token } = await createUserWithToken()
    await fundWallet(user._id, 500000)
    const ok = await createSampleOrder({ buyer: user._id, totalAmount: 100000 })
    const confirmed = await createSampleOrder({ buyer: user._id, totalAmount: 100000, status: ORDER_STATUS.CONFIRMED })
    const res = await postPayOrders(token, [ok._id.toString(), confirmed._id.toString()])
    expect(res.status).toBe(400)
  })

  it('returns 400 when any order is already paid', async () => {
    const { user, token } = await createUserWithToken()
    await fundWallet(user._id, 500000)
    const ok = await createSampleOrder({ buyer: user._id, totalAmount: 100000 })
    const paid = await createSampleOrder({ buyer: user._id, totalAmount: 100000, paymentStatus: PAYMENT_STATUS.PAID })
    const res = await postPayOrders(token, [ok._id.toString(), paid._id.toString()])
    expect(res.status).toBe(400)
  })

  it('returns 400 when wallet balance is insufficient', async () => {
    const { user, token, orders } = await makeOrders(2, 100000)
    await fundWallet(user._id, 50000)
    const res = await postPayOrders(token, orders.map(o => o._id.toString()))
    expect(res.status).toBe(400)
  })

  it('returns 400 when an order is locked from payment (refund_pending)', async () => {
    const { user, token } = await createUserWithToken()
    await fundWallet(user._id, 500000)
    const ok = await createSampleOrder({ buyer: user._id, totalAmount: 100000 })
    const refunding = await createSampleOrder({
      buyer: user._id,
      totalAmount: 100000,
      paymentStatus: PAYMENT_STATUS.REFUND_PENDING,
    })
    const res = await postPayOrders(token, [ok._id.toString(), refunding._id.toString()])
    expect(res.status).toBe(400)
  })

  it('allows paying an order left in pending_payment by an abandoned gateway attempt', async () => {
    const { user, token } = await createUserWithToken()
    await fundWallet(user._id, 500000)
    const ok = await createSampleOrder({ buyer: user._id, totalAmount: 100000 })
    const stale = await createSampleOrder({
      buyer: user._id,
      totalAmount: 100000,
      paymentStatus: PAYMENT_STATUS.PENDING_PAYMENT,
    })
    const res = await postPayOrders(token, [ok._id.toString(), stale._id.toString()])
    expect(res.status).toBe(200)

    const updated = await Order.find({ _id: { $in: [ok._id, stale._id] } })
    for (const o of updated) {
      expect(o.paymentStatus).toBe(PAYMENT_STATUS.PAID)
      expect(o.paymentMethod).toBe('wallet')
    }
  })
})

// ─────────────────────────────────────────────
// Success Path
// ─────────────────────────────────────────────

describe('POST /user-wallet/me/pay-orders — success', () => {
  it('returns 200 and marks all orders as PAID', async () => {
    const { user, token, orders } = await makeOrders(2, 100000)
    await fundWallet(user._id, 300000)
    const orderIds = orders.map(o => o._id.toString())

    const res = await postPayOrders(token, orderIds)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.orderCount).toBe(2)
    expect(res.body.data.totalAmount).toBe(200000)

    const updated = await Order.find({ _id: { $in: orderIds } })
    for (const o of updated) {
      expect(o.paymentStatus).toBe(PAYMENT_STATUS.PAID)
      expect(o.paymentMethod).toBe('wallet')
    }
  })

  it('deducts total amount from wallet in one atomic operation', async () => {
    const { user, token, orders } = await makeOrders(3, 50000)
    await fundWallet(user._id, 200000)

    await postPayOrders(token, orders.map(o => o._id.toString()))

    const wallet = await UserWallet.findOne({ user: user._id })
    expect(wallet.balance).toBe(50000)
    expect(wallet.totalSpent).toBe(150000)
  })

  it('creates one wallet transaction per order', async () => {
    const { user, token, orders } = await makeOrders(3, 80000)
    await fundWallet(user._id, 300000)
    const orderIds = orders.map(o => o._id.toString())

    await postPayOrders(token, orderIds)

    const txs = await UserWalletTransaction.find({ user: user._id, type: 'payment' })
    expect(txs).toHaveLength(3)
    for (const tx of txs) {
      expect(tx.amount).toBe(80000)
    }
  })

  it('wallet balance does not go below zero', async () => {
    const { user, token, orders } = await makeOrders(2, 100000)
    await fundWallet(user._id, 200000)

    await postPayOrders(token, orders.map(o => o._id.toString()))

    const wallet = await UserWallet.findOne({ user: user._id })
    expect(wallet.balance).toBe(0)
  })

  it('deduplicates repeated orderIds', async () => {
    const { user, token, orders } = await makeOrders(1, 100000)
    await fundWallet(user._id, 200000)
    const id = orders[0]._id.toString()

    const res = await postPayOrders(token, [id, id, id])
    expect(res.status).toBe(200)
    expect(res.body.data.orderCount).toBe(1)
    expect(res.body.data.totalAmount).toBe(100000)

    const wallet = await UserWallet.findOne({ user: user._id })
    expect(wallet.balance).toBe(100000)
  })

  it('does not deduct wallet when one order is invalid', async () => {
    const { user, token } = await createUserWithToken()
    await fundWallet(user._id, 500000)
    const ok = await createSampleOrder({ buyer: user._id, totalAmount: 100000 })
    const paid = await createSampleOrder({ buyer: user._id, totalAmount: 100000, paymentStatus: PAYMENT_STATUS.PAID })

    await postPayOrders(token, [ok._id.toString(), paid._id.toString()])

    const wallet = await UserWallet.findOne({ user: user._id })
    expect(wallet?.balance ?? 500000).toBe(500000)
  })
})
