import { jest } from '@jest/globals'

const payos = {
  paymentRequests: { create: jest.fn(), get: jest.fn() },
  webhooks: { verify: jest.fn() },
}
const userModel = { findById: jest.fn(), findByIdAndUpdate: jest.fn() }
const walletModel = { findOneAndUpdate: jest.fn() }
const walletTransactionModel = { create: jest.fn() }
const subOrderModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
}
const counterModel = { findOneAndUpdate: jest.fn() }
const postBalancedTransaction = jest.fn()
const reconcileOwnerShopQuota = jest.fn()
const roleRepo = { findByCodesWithPermissions: jest.fn() }

jest.unstable_mockModule('@payos/node', () => ({ PayOS: jest.fn(() => payos) }))
jest.unstable_mockModule('../../src/models/user.model.js', () => ({ default: userModel }))
jest.unstable_mockModule('../../src/models/user-wallet.model.js', () => ({ default: walletModel }))
jest.unstable_mockModule('../../src/models/user-wallet-transaction.model.js', () => ({ default: walletTransactionModel }))
jest.unstable_mockModule('../../src/models/subscription-order.model.js', () => ({ default: subOrderModel }))
jest.unstable_mockModule('../../src/models/counter.model.js', () => ({ default: counterModel }))
jest.unstable_mockModule('../../src/services/accounting/accounting.service.js', () => ({
  accountDefinitions: {
    userWallet: (id) => ({ key: `user:${id}` }),
    platformRevenue: () => ({ key: 'revenue' }),
    providerClearing: (provider) => ({ key: `provider:${provider}` }),
  },
  postBalancedTransaction,
}))
jest.unstable_mockModule('../../src/utils/mongo-transaction.util.js', () => ({
  runRequiredMongoTransaction: (operation) => operation({ id: 'session' }),
}))
jest.unstable_mockModule('../../src/services/shop/shop.service.js', () => ({ reconcileOwnerShopQuota }))
jest.unstable_mockModule('../../src/repositories/role/role.repository.js', () => roleRepo)

const service = await import('../../src/services/subscription/subscription.service.js')
const { requireVip } = await import('../../src/middlewares/auth.middleware.js')

const userId = '665f00000000000000000001'
const makeOrder = (overrides = {}) => ({
  _id: '665f00000000000000000002',
  user: userId,
  plan: 'monthly',
  amount: 69000,
  orderCode: 101,
  status: 'pending',
  checkoutUrl: 'https://payos.test/checkout',
  save: jest.fn(),
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  counterModel.findOneAndUpdate.mockResolvedValue({ value: 101 })
  reconcileOwnerShopQuota.mockResolvedValue({})
})

describe('subscription money safety', () => {
  it('rejects an unknown plan', async () => {
    await expect(service.createSubscriptionCheckout('weekly', { _id: userId }, 'payos', 'key'))
      .rejects.toMatchObject({ errorCode: 'INVALID_SUBSCRIPTION_PLAN' })
  })

  it('uses a durable sequence and creates a PayOS attempt idempotently', async () => {
    subOrderModel.findOne.mockResolvedValue(null)
    const order = makeOrder({ checkoutUrl: null })
    subOrderModel.create.mockResolvedValue(order)
    payos.paymentRequests.create.mockResolvedValue({ checkoutUrl: 'https://payos.test/new' })

    const result = await service.createSubscriptionCheckout('monthly', { _id: userId }, 'payos', 'payos-key')

    expect(counterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'subscription_order_code' },
      { $inc: { value: 1 } },
      expect.objectContaining({ upsert: true })
    )
    expect(subOrderModel.create).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'payos-key', orderCode: 101 }))
    expect(result.paymentUrl).toBe('https://payos.test/new')
  })

  it('runs wallet debit, order, ledger and VIP activation in one transaction', async () => {
    subOrderModel.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    walletModel.findOneAndUpdate.mockResolvedValue({ _id: 'wallet', balance: 1000 })
    const order = makeOrder({ status: 'completed' })
    subOrderModel.create.mockResolvedValue([order])
    userModel.findById.mockResolvedValue({ _id: userId, vip: null })
    userModel.findByIdAndUpdate.mockResolvedValue({ _id: userId, vip: {} })

    const result = await service.createSubscriptionCheckout('monthly', { _id: userId }, 'wallet', 'wallet-key')

    expect(postBalancedTransaction).toHaveBeenCalledWith(expect.objectContaining({
      commandKey: `subscription_payment:${order._id}`,
    }), { id: 'session' })
    expect(walletTransactionModel.create).toHaveBeenCalled()
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, expect.any(Object), expect.objectContaining({ session: { id: 'session' } }))
    expect(result.activated).toBe(true)
  })

  it('rejects an invalid PayOS webhook signature', async () => {
    payos.webhooks.verify.mockRejectedValue(new Error('invalid'))
    await expect(service.handleSubscriptionWebhook({})).rejects.toMatchObject({ errorCode: 'INVALID_SIGNATURE' })
  })

  it('rejects a verified webhook with the wrong amount', async () => {
    payos.webhooks.verify.mockResolvedValue({ orderCode: 101, code: '00', amount: 1 })
    subOrderModel.findOne.mockResolvedValue(makeOrder())
    await expect(service.handleSubscriptionWebhook({})).rejects.toMatchObject({ errorCode: 'PAYMENT_AMOUNT_MISMATCH' })
  })

  it('activates once from a verified webhook and posts a balanced command', async () => {
    const current = makeOrder()
    const completed = makeOrder({ status: 'completed' })
    payos.webhooks.verify.mockResolvedValue({ orderCode: 101, code: '00', amount: 69000 })
    subOrderModel.findOne.mockResolvedValue(current)
    subOrderModel.findOneAndUpdate.mockResolvedValue(completed)
    userModel.findById.mockResolvedValue({ _id: userId, vip: null })
    userModel.findByIdAndUpdate.mockResolvedValue({ _id: userId, vip: {} })

    const result = await service.handleSubscriptionWebhook({ signature: 'valid' })

    expect(result.status).toBe('completed')
    expect(postBalancedTransaction).toHaveBeenCalledTimes(1)
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledTimes(1)
  })

  it('keeps Return URL read-only even when provider reports PAID', async () => {
    const pending = makeOrder()
    subOrderModel.findOne.mockResolvedValue(pending)
    payos.paymentRequests.get.mockResolvedValue({ status: 'PAID' })

    const result = await service.handleSubscriptionReturn({ orderCode: '101', code: '00' }, userId)

    expect(result).toMatchObject({ status: 'pending', providerStatus: 'PAID' })
    expect(pending.save).not.toHaveBeenCalled()
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('does not trust forged Return params when provider query is unavailable', async () => {
    subOrderModel.findOne.mockResolvedValue(makeOrder())
    payos.paymentRequests.get.mockRejectedValue(new Error('timeout'))
    const result = await service.handleSubscriptionReturn({ orderCode: '101', code: '00' }, userId)
    expect(result).toMatchObject({ status: 'pending', providerStatus: 'UNAVAILABLE' })
  })
})

describe('subscription access', () => {
  it('reports active VIP', async () => {
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ vip: { plan: 'monthly', expiresAt: new Date(Date.now() + 86400000) } }),
    })
    expect(await service.getMySubscription(userId)).toMatchObject({ isActive: true, plan: 'monthly' })
  })

  it('allows admin without VIP', async () => {
    const next = jest.fn()
    await requireVip({ user: { roles: ['admin'], vip: null } }, {}, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('blocks a member without VIP or permission', async () => {
    roleRepo.findByCodesWithPermissions.mockResolvedValue([])
    const next = jest.fn()
    await requireVip({ user: { roles: ['member'], vip: null } }, {}, next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'VIP_REQUIRED' }))
  })
})
