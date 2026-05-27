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
const { default: UserWalletWithdrawal } = await import('../src/models/user-wallet-withdrawal.model.js')
const { createToken } = await import('./fixtures/testData.js')

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE = '/api/v1/user-wallet'
const ADMIN_BASE = '/api/v1/admin'
const FAKE_CHECKOUT_URL = 'https://pay.payos.vn/web/test-mock-url'

const VALID_BANK_INFO = {
  bankName: 'Vietcombank',
  accountNumber: '0123456789',
  accountName: 'NGUYEN VAN A',
  bankBranch: 'Chi nhánh HCM',
}

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
  let user, otherUser, adminUser
  let userToken, otherToken, adminToken

  beforeEach(async () => {
    jest.clearAllMocks()

    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      UserWallet.deleteMany({}),
      UserWalletTransaction.deleteMany({}),
      UserWalletTopup.deleteMany({}),
      UserWalletWithdrawal.deleteMany({}),
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

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: '123456',
      roles: ['admin'],
    })

    userToken = await createToken(user._id, 'member')
    otherToken = await createToken(otherUser._id, 'member')
    adminToken = await createToken(adminUser._id, 'admin')
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

  // ─── GET /me/activity ────────────────────────────────────────────────────────

  describe('GET /me/activity', () => {
    let wallet

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 0, totalTopUp: 0, totalSpent: 0 })
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${BASE}/me/activity`)
      expect(res.statusCode).toBe(401)
    })

    it('returns empty list when user has no wallet activity', async () => {
      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.pagination.total).toBe(0)
    })

    it('returns wallet_transaction items with correct normalized shape', async () => {
      await UserWalletTransaction.create({
        wallet: wallet._id,
        user: user._id,
        type: 'topup',
        amount: 200000,
        balanceBefore: 0,
        balanceAfter: 200000,
        status: 'completed',
        description: 'Nạp tiền 200k',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)

      const item = res.body.data[0]
      expect(item.kind).toBe('topup')
      expect(item.status).toBe('completed')
      expect(item.amount).toBe(200000)
      expect(item.balanceBefore).toBe(0)
      expect(item.balanceAfter).toBe(200000)
      expect(item.description).toBe('Nạp tiền 200k')
      expect(item.source).toBe('wallet_transaction')
      expect(item).toHaveProperty('createdAt')
    })

    it('returns topup_attempt items for pending topups with correct normalized shape', async () => {
      await makeTopup(user._id, wallet._id, {
        amount: 50000,
        orderCode: 555001,
        transactionRef: 'TOPUP_555001',
        status: 'pending',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)

      const item = res.body.data[0]
      expect(item.kind).toBe('topup')
      expect(item.status).toBe('pending')
      expect(item.amount).toBe(50000)
      expect(item.balanceBefore).toBeNull()
      expect(item.balanceAfter).toBeNull()
      expect(item.orderCode).toBe(555001)
      expect(item.orderId).toBeNull()
      expect(item.source).toBe('topup_attempt')
    })

    it('returns topup_attempt items for failed and cancelled topups', async () => {
      await makeTopup(user._id, wallet._id, {
        amount: 30000, orderCode: 555002, transactionRef: 'TOPUP_555002', status: 'failed',
      })
      await makeTopup(user._id, wallet._id, {
        amount: 40000, orderCode: 555003, transactionRef: 'TOPUP_555003', status: 'cancelled',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)

      const statuses = res.body.data.map((i) => i.status)
      expect(statuses).toContain('failed')
      expect(statuses).toContain('cancelled')
      expect(res.body.data.every((i) => i.source === 'topup_attempt')).toBe(true)
    })

    it('does NOT duplicate a completed topup — shows once as wallet_transaction only', async () => {
      const topup = await makeTopup(user._id, wallet._id, {
        amount: 100000, orderCode: 555004, transactionRef: 'TOPUP_555004', status: 'completed',
      })
      await UserWalletTransaction.create({
        wallet: wallet._id,
        user: user._id,
        topup: topup._id,
        type: 'topup',
        amount: 100000,
        balanceBefore: 0,
        balanceAfter: 100000,
        description: 'Nạp tiền 100k',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].source).toBe('wallet_transaction')
    })

    it('wallet_transaction of type topup includes orderCode from linked topup', async () => {
      const topup = await makeTopup(user._id, wallet._id, {
        amount: 100000, orderCode: 777001, transactionRef: 'TOPUP_777001', status: 'completed',
      })
      await UserWalletTransaction.create({
        wallet: wallet._id,
        user: user._id,
        topup: topup._id,
        type: 'topup',
        amount: 100000,
        balanceBefore: 0,
        balanceAfter: 100000,
        description: 'Nạp tiền 100k',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      const item = res.body.data[0]
      expect(item.kind).toBe('topup')
      expect(item.orderCode).toBe(777001)
      expect(item.source).toBe('wallet_transaction')
    })

    it('returns payment and refund transactions with orderId', async () => {
      const order = await Order.create({
        buyer: user._id,
        product: new mongoose.Types.ObjectId(),
        quantity: 1,
        unitPrice: 150000,
        totalAmount: 150000,
        status: 'pending',
        paymentStatus: 'paid',
        isActive: true,
      })

      await UserWalletTransaction.create({
        wallet: wallet._id,
        user: user._id,
        order: order._id,
        type: 'payment',
        amount: 150000,
        balanceBefore: 500000,
        balanceAfter: 350000,
        description: 'Thanh toán đơn hàng',
      })
      await UserWalletTransaction.create({
        wallet: wallet._id,
        user: user._id,
        order: order._id,
        type: 'refund',
        amount: 150000,
        balanceBefore: 350000,
        balanceAfter: 500000,
        description: 'Hoàn tiền đơn hàng',
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)

      const kinds = res.body.data.map((i) => i.kind)
      expect(kinds).toContain('payment')
      expect(kinds).toContain('refund')

      const payment = res.body.data.find((i) => i.kind === 'payment')
      expect(payment.orderId).toBe(order._id.toString())
      expect(payment.source).toBe('wallet_transaction')
    })

    it('merges wallet_transactions and topup_attempts sorted by createdAt desc', async () => {
      const older = new Date('2026-01-01T10:00:00Z')
      const newer = new Date('2026-01-02T10:00:00Z')

      await UserWalletTransaction.create({
        wallet: wallet._id, user: user._id, type: 'topup',
        amount: 100000, balanceBefore: 0, balanceAfter: 100000,
        description: 'tx older', createdAt: older, updatedAt: older,
      })
      await makeTopup(user._id, wallet._id, {
        amount: 50000, orderCode: 444001, transactionRef: 'TOPUP_444001',
        status: 'pending', createdAt: newer, updatedAt: newer,
      })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
      // newest first
      expect(new Date(res.body.data[0].createdAt) >= new Date(res.body.data[1].createdAt)).toBe(true)
      expect(res.body.data[0].source).toBe('topup_attempt')
      expect(res.body.data[1].source).toBe('wallet_transaction')
    })

    it('paginates correctly across merged sources', async () => {
      // 2 wallet_transactions + 2 topup_attempts = 4 total
      await UserWalletTransaction.create([
        { wallet: wallet._id, user: user._id, type: 'topup', amount: 10000, balanceBefore: 0, balanceAfter: 10000, description: 'tx1' },
        { wallet: wallet._id, user: user._id, type: 'payment', amount: 10000, balanceBefore: 10000, balanceAfter: 0, description: 'tx2' },
      ])
      await makeTopup(user._id, wallet._id, { amount: 10000, orderCode: 333001, transactionRef: 'TOPUP_333001', status: 'pending' })
      await makeTopup(user._id, wallet._id, { amount: 10000, orderCode: 333002, transactionRef: 'TOPUP_333002', status: 'failed' })

      const res1 = await request(app)
        .get(`${BASE}/me/activity?page=1&limit=2`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res1.statusCode).toBe(200)
      expect(res1.body.data.length).toBe(2)
      expect(res1.body.meta.pagination.total).toBe(4)
      expect(res1.body.meta.pagination.totalPages).toBe(2)
      expect(res1.body.meta.pagination.hasNextPage).toBe(true)

      const res2 = await request(app)
        .get(`${BASE}/me/activity?page=2&limit=2`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res2.statusCode).toBe(200)
      expect(res2.body.data.length).toBe(2)
      expect(res2.body.meta.pagination.hasPrevPage).toBe(true)
      expect(res2.body.meta.pagination.hasNextPage).toBe(false)

      // Không item nào trùng nhau giữa 2 trang
      const ids1 = res1.body.data.map((i) => i._id)
      const ids2 = res2.body.data.map((i) => i._id)
      expect(ids1.some((id) => ids2.includes(id))).toBe(false)
    })

    it('only returns activity belonging to the authenticated user', async () => {
      const otherWallet = await UserWallet.create({ user: otherUser._id, balance: 0 })

      await UserWalletTransaction.create({
        wallet: wallet._id, user: user._id, type: 'topup',
        amount: 100000, balanceBefore: 0, balanceAfter: 100000, description: 'my tx',
      })
      await UserWalletTransaction.create({
        wallet: otherWallet._id, user: otherUser._id, type: 'topup',
        amount: 200000, balanceBefore: 0, balanceAfter: 200000, description: 'other tx',
      })
      await makeTopup(user._id, wallet._id, { amount: 50000, orderCode: 222001, transactionRef: 'TOPUP_222001', status: 'pending' })
      await makeTopup(otherUser._id, otherWallet._id, { amount: 60000, orderCode: 222002, transactionRef: 'TOPUP_222002', status: 'pending' })

      const res = await request(app)
        .get(`${BASE}/me/activity`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
      expect(res.body.meta.pagination.total).toBe(2)
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

  // ─── POST /me/withdrawals ─────────────────────────────────────────────────────

  describe('POST /me/withdrawals', () => {
    let wallet

    beforeEach(async () => {
      wallet = await UserWallet.create({
        user: user._id,
        balance: 500000,
        totalTopUp: 500000,
      })
    })

    it('creates withdrawal, deducts balance and moves to pendingBalance', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 200000, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.amount).toBe(200000)
      expect(res.body.data.status).toBe('pending')
      expect(res.body.data.bankInfo.bankName).toBe('Vietcombank')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(300000)
      expect(updatedWallet.pendingBalance).toBe(200000)
    })

    it('returns 400 when balance is insufficient', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 600000, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)

      const unchanged = await UserWallet.findById(wallet._id)
      expect(unchanged.balance).toBe(500000)
      expect(unchanged.pendingBalance).toBe(0)
    })

    it('returns 400 when a pending withdrawal already exists', async () => {
      await UserWalletWithdrawal.create({
        user: user._id,
        wallet: wallet._id,
        amount: 100000,
        bankInfo: VALID_BANK_INFO,
        status: 'pending',
      })

      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 100000, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when amount is below minimum (49999)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 49999, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when bankInfo is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 100000 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when bankInfo.accountNumber is missing', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 100000, bankInfo: { bankName: 'VCB', accountName: 'A' } })

      expect(res.statusCode).toBe(422)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .send({ amount: 100000, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(401)
    })

    it('accepts minimum valid amount (50000)', async () => {
      const res = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 50000, bankInfo: VALID_BANK_INFO })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.amount).toBe(50000)
    })
  })

  // ─── GET /me/withdrawals ──────────────────────────────────────────────────────

  describe('GET /me/withdrawals', () => {
    let wallet

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 500000, totalTopUp: 500000 })
    })

    it('returns empty list when no withdrawals', async () => {
      const res = await request(app)
        .get(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.pagination.total).toBe(0)
    })

    it('returns only withdrawals belonging to the authenticated user', async () => {
      const otherWallet = await UserWallet.create({ user: otherUser._id, balance: 300000 })

      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 100000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
      await UserWalletWithdrawal.create({
        user: otherUser._id, wallet: otherWallet._id,
        amount: 200000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })

      const res = await request(app)
        .get(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.meta.pagination.total).toBe(1)
    })

    it('filters by status', async () => {
      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 100000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 200000, bankInfo: VALID_BANK_INFO, status: 'completed',
      })

      const res = await request(app)
        .get(`${BASE}/me/withdrawals?status=pending`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].status).toBe('pending')
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${BASE}/me/withdrawals`)
      expect(res.statusCode).toBe(401)
    })
  })

  // ─── Admin: GET /admin/user-withdrawals ───────────────────────────────────────

  describe('GET /admin/user-withdrawals', () => {
    let wallet

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 500000 })
    })

    it('returns all user withdrawals for admin', async () => {
      const otherWallet = await UserWallet.create({ user: otherUser._id, balance: 200000 })

      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id, amount: 100000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
      await UserWalletWithdrawal.create({
        user: otherUser._id, wallet: otherWallet._id, amount: 150000, bankInfo: VALID_BANK_INFO, status: 'approved',
      })

      const res = await request(app)
        .get(`${ADMIN_BASE}/user-withdrawals`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
      expect(res.body.meta.pagination.total).toBe(2)
    })

    it('filters by status', async () => {
      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id, amount: 100000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
      await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id, amount: 200000, bankInfo: VALID_BANK_INFO, status: 'completed',
      })

      const res = await request(app)
        .get(`${ADMIN_BASE}/user-withdrawals?status=completed`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].status).toBe('completed')
    })

    it('returns 403 when called by non-admin', async () => {
      const res = await request(app)
        .get(`${ADMIN_BASE}/user-withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(403)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get(`${ADMIN_BASE}/user-withdrawals`)
      expect(res.statusCode).toBe(401)
    })
  })

  // ─── Admin: PATCH /admin/user-withdrawals/:id/approve ────────────────────────

  describe('PATCH /admin/user-withdrawals/:id/approve', () => {
    let wallet, withdrawal

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 300000, pendingBalance: 200000 })
      withdrawal = await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 200000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
    })

    it('approves pending withdrawal — status becomes approved', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('approved')
      expect(res.body.data.approvedBy).toBeTruthy()
      expect(res.body.data.approvedAt).toBeTruthy()

      // wallet balance không thay đổi khi approve
      const unchanged = await UserWallet.findById(wallet._id)
      expect(unchanged.balance).toBe(300000)
      expect(unchanged.pendingBalance).toBe(200000)
    })

    it('returns 400 when withdrawal is not in pending status', async () => {
      await UserWalletWithdrawal.findByIdAndUpdate(withdrawal._id, { status: 'approved' })

      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 404 when withdrawal does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()

      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${fakeId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when called by non-admin', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/approve`)
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── Admin: PATCH /admin/user-withdrawals/:id/reject ─────────────────────────

  describe('PATCH /admin/user-withdrawals/:id/reject', () => {
    let wallet, withdrawal

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 300000, pendingBalance: 200000 })
      withdrawal = await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 200000, bankInfo: VALID_BANK_INFO, status: 'pending',
      })
    })

    it('rejects withdrawal and reverts balance back', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Thông tin tài khoản không hợp lệ' })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('rejected')
      expect(res.body.data.rejectionReason).toBe('Thông tin tài khoản không hợp lệ')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.balance).toBe(500000)
      expect(updatedWallet.pendingBalance).toBe(0)
    })

    it('returns 400 when withdrawal is already rejected', async () => {
      await UserWalletWithdrawal.findByIdAndUpdate(withdrawal._id, { status: 'rejected' })

      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Lý do' })

      expect(res.statusCode).toBe(400)
    })

    it('returns 422 when rejectionReason is missing', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(res.statusCode).toBe(422)
    })

    it('returns 403 when called by non-admin', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/reject`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rejectionReason: 'Lý do' })

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── Admin: PATCH /admin/user-withdrawals/:id/complete ───────────────────────

  describe('PATCH /admin/user-withdrawals/:id/complete', () => {
    let wallet, withdrawal

    beforeEach(async () => {
      wallet = await UserWallet.create({ user: user._id, balance: 300000, pendingBalance: 200000 })
      withdrawal = await UserWalletWithdrawal.create({
        user: user._id, wallet: wallet._id,
        amount: 200000, bankInfo: VALID_BANK_INFO, status: 'approved',
      })
    })

    it('completes withdrawal — pendingBalance → 0, totalWithdrawn increases, WITHDRAWAL tx created', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adminNote: 'Đã chuyển khoản',
          transferProof: {
            transactionId: 'TXN001',
            bankTransferRef: 'REF001',
          },
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.status).toBe('completed')
      expect(res.body.data.completedBy).toBeTruthy()
      expect(res.body.data.completedAt).toBeTruthy()
      expect(res.body.data.transferProof.transactionId).toBe('TXN001')

      const updatedWallet = await UserWallet.findById(wallet._id)
      expect(updatedWallet.pendingBalance).toBe(0)
      expect(updatedWallet.totalWithdrawn).toBe(200000)

      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'withdrawal' })
      expect(tx).not.toBeNull()
      expect(tx.amount).toBe(200000)
    })

    it('returns 400 when withdrawal is not in approved status', async () => {
      await UserWalletWithdrawal.findByIdAndUpdate(withdrawal._id, { status: 'pending' })

      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(res.statusCode).toBe(400)
    })

    it('returns 404 when withdrawal does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString()

      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${fakeId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})

      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when called by non-admin', async () => {
      const res = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawal._id}/complete`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})

      expect(res.statusCode).toBe(403)
    })
  })

  // ─── Full withdrawal flow integration ────────────────────────────────────────

  describe('Full withdrawal flow: request → approve → complete', () => {
    it('goes through the full lifecycle correctly', async () => {
      await UserWallet.create({ user: user._id, balance: 500000, totalTopUp: 500000 })

      // 1. User tạo withdrawal request
      const createRes = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 200000, bankInfo: VALID_BANK_INFO })

      expect(createRes.statusCode).toBe(201)
      const withdrawalId = createRes.body.data._id

      let w = await UserWallet.findOne({ user: user._id })
      expect(w.balance).toBe(300000)
      expect(w.pendingBalance).toBe(200000)

      // 2. Admin approve
      const approveRes = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawalId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(approveRes.statusCode).toBe(200)
      expect(approveRes.body.data.status).toBe('approved')

      // balance không thay đổi khi approve
      w = await UserWallet.findOne({ user: user._id })
      expect(w.balance).toBe(300000)
      expect(w.pendingBalance).toBe(200000)

      // 3. Admin complete
      const completeRes = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawalId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ adminNote: 'Chuyển xong', transferProof: { transactionId: 'TXN999' } })

      expect(completeRes.statusCode).toBe(200)
      expect(completeRes.body.data.status).toBe('completed')

      w = await UserWallet.findOne({ user: user._id })
      expect(w.balance).toBe(300000)
      expect(w.pendingBalance).toBe(0)
      expect(w.totalWithdrawn).toBe(200000)

      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'withdrawal' })
      expect(tx).not.toBeNull()
      expect(tx.amount).toBe(200000)
    })

    it('full flow with rejection — balance fully restored', async () => {
      await UserWallet.create({ user: user._id, balance: 400000, totalTopUp: 400000 })

      const createRes = await request(app)
        .post(`${BASE}/me/withdrawals`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 150000, bankInfo: VALID_BANK_INFO })

      expect(createRes.statusCode).toBe(201)
      const withdrawalId = createRes.body.data._id

      let w = await UserWallet.findOne({ user: user._id })
      expect(w.balance).toBe(250000)
      expect(w.pendingBalance).toBe(150000)

      const rejectRes = await request(app)
        .patch(`${ADMIN_BASE}/user-withdrawals/${withdrawalId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Tài khoản không hợp lệ' })

      expect(rejectRes.statusCode).toBe(200)
      expect(rejectRes.body.data.status).toBe('rejected')

      w = await UserWallet.findOne({ user: user._id })
      expect(w.balance).toBe(400000)
      expect(w.pendingBalance).toBe(0)

      // Không có tx withdrawal nào được tạo khi reject
      const tx = await UserWalletTransaction.findOne({ user: user._id, type: 'withdrawal' })
      expect(tx).toBeNull()
    })
  })
})
