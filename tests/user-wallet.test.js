import { jest } from '@jest/globals'

// ─── Mock @payos/node trước khi import app ────────────────────────────────────
// Dùng module-level fn để test có thể reconfigure per-test qua mockResolvedValue
const mockPayosCreate = jest.fn()
const mockPayosGet = jest.fn()

jest.unstable_mockModule('@payos/node', () => ({
  PayOS: jest.fn().mockImplementation(() => ({
    paymentRequests: {
      create: mockPayosCreate,
      get: mockPayosGet,
    },
    webhooks: {
      verify: jest.fn(),
    },
  })),
}))

// ─── Dynamic imports (phải sau unstable_mockModule) ───────────────────────────
const { default: request } = await import('supertest')
const { default: mongoose } = await import('mongoose')
const { default: app } = await import('../src/server.js')
const { default: User } = await import('../src/models/user.model.js')
const { default: Order } = await import('../src/models/order.model.js')
const { default: UserWallet } = await import('../src/models/user-wallet.model.js')
const { default: UserWalletTransaction } = await import('../src/models/user-wallet-transaction.model.js')
const { default: UserWalletTopup } = await import('../src/models/user-wallet-topup.model.js')
const { createToken } = await import('./fixtures/testData.js')

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE = '/api/v1/user-wallet'
const FAKE_CHECKOUT_URL = 'https://pay.payos.vn/web/test-mock-url'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeOrder = (buyerId, overrides = {}) =>
  Order.create({
    buyer: buyerId,
    product: new mongoose.Types.ObjectId(),
    quantity: 1,
    unitPrice: 100000,
    totalAmount: 100000,
    status: 'pending',
    paymentStatus: 'unpaid',
    isActive: true,
    ...overrides,
  })

const makeTopup = (userId, walletId, overrides = {}) =>
  UserWalletTopup.create({
    user: userId,
    wallet: walletId,
    amount: 100000,
    orderCode: Math.floor(Math.random() * 900000000) + 100000000,
    transactionRef: `TOPUP_${Date.now()}`,
    status: 'pending',
    checkoutUrl: FAKE_CHECKOUT_URL,
    ...overrides,
  })

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('User Wallet API', () => {
  let user, otherUser
  let userToken, otherToken

  beforeEach(async () => {
    jest.clearAllMocks()

    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      UserWallet.deleteMany({}),
      UserWalletTransaction.deleteMany({}),
      UserWalletTopup.deleteMany({}),
    ])

    // Default PayOS mock responses
    mockPayosCreate.mockResolvedValue({ checkoutUrl: FAKE_CHECKOUT_URL })
    mockPayosGet.mockResolvedValue({ status: 'PAID' })

    user = await User.create({
      name: 'Wallet User',
      email: 'wallet-user@example.com',
      password: '123456',
      roles: ['member'],
    })

    otherUser = await User.create({
      name: 'Other User',
      email: 'other-user@example.com',
      password: '123456',
      roles: ['member'],
    })

    userToken = await createToken(user._id, 'member')
    otherToken = await createToken(otherUser._id, 'member')
  })

  // ─── GET /me ─────────────────────────────────────────────────────────────────

  describe('GET /me', () => {
    it('returns zero-balance object when no wallet document exists', async () => {
      const res = await request(app)
        .get(`${BASE}/me`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.balance).toBe(0)
      expect(res.body.data.totalTopUp).toBe(0)
      expect(res.body.data.totalSpent).toBe(0)
    })

    it('returns correct wallet data when wallet exists', async () => {
      await UserWallet.create({
        user: user._id,
        balance: 350000,
        totalTopUp: 500000,
        totalSpent: 150000,
      })

      const res = await request(app)
        .get(`${BASE}/me`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.balance).toBe(350000)
      expect(res.body.data.totalTopUp).toBe(500000)
      expect(res.body.data.totalSpent).toBe(150000)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${BASE}/me`)
      expect(res.statusCode).toBe(401)
    })
  })

  // ─── GET /me/transactions ─────────────────────────────────────────────────────

  describe('GET /me/transactions', () => {
    it('returns empty list when no transactions', async () => {
      const res = await request(app)
        .get(`${BASE}/me/transactions`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.pagination.total).toBe(0)
    })

    it('returns only transactions belonging to the authenticated user', async () => {
      const wallet = await UserWallet.create({ user: user._id, balance: 100000, totalTopUp: 100000 })
      const otherWallet = await UserWallet.create({ user: otherUser._id, balance: 50000, totalTopUp: 50000 })

      await UserWalletTransaction.create({
        wallet: wallet._id, user: user._id,
        type: 'topup', amount: 100000,
        balanceBefore: 0, balanceAfter: 100000,
        description: 'Nạp tiền test',
      })
      await UserWalletTransaction.create({
        wallet: otherWallet._id, user: otherUser._id,
        type: 'topup', amount: 50000,
        balanceBefore: 0, balanceAfter: 50000,
        description: 'Nạp tiền user khác',
      })

      const res = await request(app)
        .get(`${BASE}/me/transactions`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.meta.pagination.total).toBe(1)
      expect(res.body.data[0].type).toBe('topup')
      expect(res.body.data[0].amount).toBe(100000)
    })

    it('paginates correctly', async () => {
      const wallet = await UserWallet.create({ user: user._id, balance: 0 })
      await UserWalletTransaction.create([
        { wallet: wallet._id, user: user._id, type: 'topup', amount: 10000, balanceBefore: 0, balanceAfter: 10000, description: 'tx1' },
        { wallet: wallet._id, user: user._id, type: 'topup', amount: 20000, balanceBefore: 10000, balanceAfter: 30000, description: 'tx2' },
        { wallet: wallet._id, user: user._id, type: 'topup', amount: 30000, balanceBefore: 30000, balanceAfter: 60000, description: 'tx3' },
      ])

      const res = await request(app)
        .get(`${BASE}/me/transactions?page=1&limit=2`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
      expect(res.body.meta.pagination.total).toBe(3)
      expect(res.body.meta.pagination.totalPages).toBe(2)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${BASE}/me/transactions`)
      expect(res.statusCode).toBe(401)
    })
  })

  // ─── GET /me/topups ───────────────────────────────────────────────────────────

  describe('GET /me/topups', () => {
    it('returns empty list when no topups', async () => {
      const res = await request(app)
        .get(`${BASE}/me/topups`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.pagination.total).toBe(0)
    })

    it('returns only topups belonging to the authenticated user', async () => {
      const wallet = await UserWallet.create({ user: user._id, balance: 0 })
      const otherWallet = await UserWallet.create({ user: otherUser._id, balance: 0 })

      await UserWalletTopup.create({
        user: user._id, wallet: wallet._id,
        amount: 50000, orderCode: 111001,
        transactionRef: 'TOPUP_111001',
        status: 'completed',
        checkoutUrl: FAKE_CHECKOUT_URL,
      })
      await UserWalletTopup.create({
        user: otherUser._id, wallet: otherWallet._id,
        amount: 30000, orderCode: 111002,
        transactionRef: 'TOPUP_111002',
        status: 'pending',
        checkoutUrl: FAKE_CHECKOUT_URL,
      })

      const res = await request(app)
        .get(`${BASE}/me/topups`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].orderCode).toBe(111001)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${BASE}/me/topups`)
      expect(res.statusCode).toBe(401)
    })
  })

  // ─── POST /me/topup ───────────────────────────────────────────────────────────

  describe('POST /me/topup', () => {
    it('creates topup record and returns PayOS checkoutUrl', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50000 })

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.paymentUrl).toBe(FAKE_CHECKOUT_URL)
      expect(res.body.data.topup.status).toBe('pending')
      expect(res.body.data.topup.amount).toBe(50000)
      expect(res.body.data.topup.checkoutUrl).toBe(FAKE_CHECKOUT_URL)
      expect(mockPayosCreate).toHaveBeenCalledTimes(1)
    })

    it('returns existing pending topup without creating duplicate (dedup)', async () => {
      const wallet = await UserWallet.create({ user: user._id, balance: 0 })
      const existing = await makeTopup(user._id, wallet._id, {
        amount: 50000,
        orderCode: 999001,
        transactionRef: 'TOPUP_999001',
        checkoutUrl: FAKE_CHECKOUT_URL,
      })

      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50000 })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.topup._id).toBe(existing._id.toString())
      expect(res.body.data.paymentUrl).toBe(FAKE_CHECKOUT_URL)
      // PayOS không được gọi khi trả về topup cũ
      expect(mockPayosCreate).not.toHaveBeenCalled()

      const count = await UserWalletTopup.countDocuments({ user: user._id })
      expect(count).toBe(1)
    })

    it('accepts minimum valid amount (10000)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 10000 })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.topup.amount).toBe(10000)
    })

    it('accepts maximum valid amount (50000000)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50000000 })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.topup.amount).toBe(50000000)
    })

    it('returns 422 when amount is below minimum (9999)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 9999 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when amount exceeds maximum (50000001)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50000001 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when amount is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup`)
        .send({ amount: 50000 })

      expect(res.statusCode).toBe(401)
    })
  })

  // ─── POST /me/topup/verify ────────────────────────────────────────────────────

  describe('POST /me/topup/verify', () => {
    let wallet, topup

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 0, totalTopUp: 0 })
      topup = await makeTopup(user._id, wallet._id, {
        amount: 100000,
        orderCode: 888001,
        transactionRef: 'TOPUP_888001',
      })
    })

    it('credits wallet when PayOS reports PAID', async () => {
      mockPayosGet.mockResolvedValue({ status: 'PAID', orderCode: 888001 })

      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 888001 })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('completed')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(100000)
      expect(updatedWallet.totalTopUp).toBe(100000)

      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'topup' })
      expect(tx).not.toBeNull()
      expect(tx.amount).toBe(100000)
      expect(tx.balanceBefore).toBe(0)
      expect(tx.balanceAfter).toBe(100000)
    })

    it('marks topup as cancelled when PayOS reports CANCELLED', async () => {
      mockPayosGet.mockResolvedValue({ status: 'CANCELLED', orderCode: 888001 })

      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 888001 })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('cancelled')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(0)

      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'topup' })
      expect(tx).toBeNull()
    })

    it('returns pending status when PayOS reports PENDING (payment not yet completed)', async () => {
      mockPayosGet.mockResolvedValue({ status: 'PENDING', orderCode: 888001 })

      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 888001 })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('pending')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(0)
    })

    it('is idempotent — calling verify twice only credits wallet once', async () => {
      mockPayosGet.mockResolvedValue({ status: 'PAID', orderCode: 888001 })

      await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 888001 })

      await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 888001 })

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(100000)

      const txCount = await UserWalletTransaction.countDocuments({ user: user._id, type: 'topup' })
      expect(txCount).toBe(1)
    })

    it('returns 403 when a different user tries to verify the topup', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderCode: 888001 })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('returns 404 when orderCode does not exist', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderCode: 999999999 })

      expect(res.statusCode).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when orderCode is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/me/topup/verify`)
        .send({ orderCode: 888001 })

      expect(res.statusCode).toBe(401)
    })
  })

  // ─── POST /me/pay-order ───────────────────────────────────────────────────────

  describe('POST /me/pay-order', () => {
    let wallet, order

    beforeEach(async () => {
      wallet = await UserWallet.create({
        user: user._id,
        balance: 500000,
        totalTopUp: 500000,
        totalSpent: 0,
      })

      order = await makeOrder(user._id)
    })

    it('deducts amount from wallet and marks order as paid', async () => {
      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.wallet.balance).toBe(400000)

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(400000)
      expect(updatedWallet.totalSpent).toBe(100000)

      const updatedOrder = await Order.findById(order._id)
      expect(updatedOrder.paymentStatus).toBe('paid')
      expect(updatedOrder.paymentMethod).toBe('wallet')
    })

    it('creates a PAYMENT transaction record with correct balance snapshot', async () => {
      await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'payment' })
      expect(tx).not.toBeNull()
      expect(tx.amount).toBe(100000)
      expect(tx.balanceBefore).toBe(500000)
      expect(tx.balanceAfter).toBe(400000)
    })

    it('returns 400 when wallet balance is insufficient', async () => {
      await UserWallet.findByIdAndUpdate(wallet._id, { balance: 50000 })

      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)

      // Wallet không thay đổi
      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(50000)
    })

    it('returns 400 when user has no wallet', async () => {
      await UserWallet.deleteMany({})

      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 403 when user is not the buyer', async () => {
      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)

      // Order không thay đổi
      const unchanged = await Order.findById(order._id)
      expect(unchanged.paymentStatus).toBe('unpaid')
    })

    it('returns 400 when order is already paid', async () => {
      await Order.findByIdAndUpdate(order._id, { paymentStatus: 'paid' })

      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 400 when order status is not pending (e.g. confirmed)', async () => {
      await Order.findByIdAndUpdate(order._id, { status: 'confirmed' })

      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 404 when orderId does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()

      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: fakeId })

      expect(res.statusCode).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when orderId format is invalid', async () => {
      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ orderId: 'not-a-valid-id' })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/me/pay-order`)
        .send({ orderId: order._id.toString() })

      expect(res.statusCode).toBe(401)
    })
  })
})
