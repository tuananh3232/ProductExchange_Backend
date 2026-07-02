import { jest } from '@jest/globals'

// --- mock stubs (declared before jest.unstable_mockModule) ---

const payosInstance = {
  paymentRequests: { create: jest.fn(), get: jest.fn() },
  webhooks: { verify: jest.fn() },
}
const PayOSCtor = jest.fn().mockImplementation(() => payosInstance)

const userModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}

const subOrderModel = {
  findOne: jest.fn(),
  create: jest.fn(),
}

const roleRepo = {
  findByCodesWithPermissions: jest.fn(),
}

jest.unstable_mockModule('@payos/node', () => ({ PayOS: PayOSCtor }))
jest.unstable_mockModule('../../src/models/user.model.js', () => ({ default: userModel }))
jest.unstable_mockModule('../../src/models/subscription-order.model.js', () => ({ default: subOrderModel }))
jest.unstable_mockModule('../../src/repositories/role/role.repository.js', () => roleRepo)
jest.unstable_mockModule('../../src/services/shop/shop.service.js', () => ({
  reconcileOwnerShopQuota: jest.fn().mockResolvedValue({ allowedCount: 1, totalShops: 0, changed: false }),
}))

const {
  createSubscriptionCheckout,
  handleSubscriptionWebhook,
  handleSubscriptionReturn,
  getMySubscription,
  PLANS,
} = await import('../../src/services/subscription/subscription.service.js')

const { requireVip } = await import('../../src/middlewares/auth.middleware.js')

// --- helpers ---

const objectId = (n) => `665f000000000000000000${String(n).padStart(2, '0')}`
const userId = objectId(1)

const futureDate = (days = 30) => new Date(Date.now() + days * 86_400_000)
const pastDate = (days = 1) => new Date(Date.now() - days * 86_400_000)

const makeSubOrder = (overrides = {}) => ({
  _id: objectId(2),
  user: userId,
  plan: 'monthly',
  amount: 69000,
  orderCode: 123456,
  transactionRef: 'SUB_123456',
  status: 'pending',
  checkoutUrl: 'https://pay.os/test',
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

const makeUser = (vip = null) => ({
  _id: userId,
  vip,
})

beforeEach(() => {
  jest.clearAllMocks()
})

// =============================================================================
// createSubscriptionCheckout
// =============================================================================
describe('createSubscriptionCheckout', () => {
  const userCtx = { _id: userId }

  it('throws INVALID_SUBSCRIPTION_PLAN for unknown plan', async () => {
    await expect(createSubscriptionCheckout('weekly', userCtx)).rejects.toMatchObject({
      errorCode: 'INVALID_SUBSCRIPTION_PLAN',
    })
  })

  it('returns existing pending checkout URL without calling PayOS', async () => {
    const existing = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(existing)

    const result = await createSubscriptionCheckout('monthly', userCtx)

    expect(result.paymentUrl).toBe(existing.checkoutUrl)
    expect(result.plan).toBe('monthly')
    expect(payosInstance.paymentRequests.create).not.toHaveBeenCalled()
  })

  it('creates new checkout link when no pending order exists (monthly)', async () => {
    subOrderModel.findOne.mockResolvedValue(null)
    payosInstance.paymentRequests.create.mockResolvedValue({ checkoutUrl: 'https://pay.os/new' })
    subOrderModel.create.mockResolvedValue({})

    const result = await createSubscriptionCheckout('monthly', userCtx)

    expect(payosInstance.paymentRequests.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: PLANS.monthly.price,
        returnUrl: expect.any(String),
        cancelUrl: expect.any(String),
      })
    )
    expect(subOrderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: userId,
        plan: 'monthly',
        amount: PLANS.monthly.price,
        status: 'pending',
      })
    )
    expect(result.paymentUrl).toBe('https://pay.os/new')
    expect(result.plan).toBe('monthly')
  })

  it('creates new checkout link with correct price for yearly plan', async () => {
    subOrderModel.findOne.mockResolvedValue(null)
    payosInstance.paymentRequests.create.mockResolvedValue({ checkoutUrl: 'https://pay.os/yearly' })
    subOrderModel.create.mockResolvedValue({})

    const result = await createSubscriptionCheckout('yearly', userCtx)

    expect(payosInstance.paymentRequests.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: PLANS.yearly.price })
    )
    expect(result.plan).toBe('yearly')
  })
})

// =============================================================================
// handleSubscriptionWebhook
// =============================================================================
describe('handleSubscriptionWebhook', () => {
  it('throws INVALID_SIGNATURE when PayOS verify throws', async () => {
    payosInstance.webhooks.verify.mockRejectedValue(new Error('bad sig'))

    await expect(handleSubscriptionWebhook({ signature: 'bad' })).rejects.toMatchObject({
      errorCode: 'INVALID_SIGNATURE',
    })
  })

  it('throws SUBSCRIPTION_NOT_FOUND when order does not exist', async () => {
    payosInstance.webhooks.verify.mockResolvedValue({ orderCode: 123456, code: '00' })
    subOrderModel.findOne.mockResolvedValue(null)

    await expect(handleSubscriptionWebhook({})).rejects.toMatchObject({
      errorCode: 'SUBSCRIPTION_NOT_FOUND',
    })
  })

  it('is idempotent — skips already-processed orders', async () => {
    payosInstance.webhooks.verify.mockResolvedValue({ orderCode: 123456, code: '00' })
    const sub = makeSubOrder({ status: 'completed' })
    subOrderModel.findOne.mockResolvedValue(sub)

    const result = await handleSubscriptionWebhook({})

    expect(result.status).toBe('completed')
    expect(sub.save).not.toHaveBeenCalled()
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('activates VIP and marks order completed on code 00', async () => {
    payosInstance.webhooks.verify.mockResolvedValue({ orderCode: 123456, code: '00' })
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    userModel.findById.mockResolvedValue(makeUser(null))
    userModel.findByIdAndUpdate.mockResolvedValue({})

    const result = await handleSubscriptionWebhook({})

    expect(result.status).toBe('completed')
    expect(sub.paidAt).toBeInstanceOf(Date)
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ 'vip.plan': 'monthly', 'vip.expiresAt': expect.any(Date) }),
      { new: true }
    )
    expect(sub.save).toHaveBeenCalled()
  })

  it('marks order failed and skips VIP activation on non-00 code', async () => {
    payosInstance.webhooks.verify.mockResolvedValue({ orderCode: 123456, code: '01' })
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)

    const result = await handleSubscriptionWebhook({})

    expect(result.status).toBe('failed')
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled()
    expect(sub.save).toHaveBeenCalled()
  })
})

// =============================================================================
// handleSubscriptionReturn
// =============================================================================
describe('handleSubscriptionReturn', () => {
  it('throws MISSING_ORDER_CODE when query has no orderCode', async () => {
    await expect(handleSubscriptionReturn({}, userId)).rejects.toMatchObject({
      errorCode: 'MISSING_ORDER_CODE',
    })
  })

  it('throws SUBSCRIPTION_NOT_FOUND when order does not exist', async () => {
    subOrderModel.findOne.mockResolvedValue(null)

    await expect(handleSubscriptionReturn({ orderCode: '123456' }, userId)).rejects.toMatchObject({
      errorCode: 'SUBSCRIPTION_NOT_FOUND',
    })
  })

  it('throws FORBIDDEN when order belongs to a different user', async () => {
    const sub = makeSubOrder({ user: objectId(99) })
    subOrderModel.findOne.mockResolvedValue(sub)

    await expect(handleSubscriptionReturn({ orderCode: '123456' }, userId)).rejects.toMatchObject({
      errorCode: 'FORBIDDEN',
    })
  })

  it('is idempotent — returns current status for already-processed order', async () => {
    const sub = makeSubOrder({ status: 'completed' })
    subOrderModel.findOne.mockResolvedValue(sub)

    const result = await handleSubscriptionReturn({ orderCode: '123456' }, userId)

    expect(result.status).toBe('completed')
    expect(sub.save).not.toHaveBeenCalled()
  })

  it('activates VIP and marks completed when PayOS API returns PAID', async () => {
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    payosInstance.paymentRequests.get.mockResolvedValue({ status: 'PAID' })
    userModel.findById.mockResolvedValue(makeUser(null))
    userModel.findByIdAndUpdate.mockResolvedValue({})

    const result = await handleSubscriptionReturn({ orderCode: '123456' }, userId)

    expect(result.status).toBe('completed')
    expect(userModel.findByIdAndUpdate).toHaveBeenCalled()
    expect(sub.save).toHaveBeenCalled()
  })

  it('marks cancelled and skips VIP when PayOS returns CANCELLED', async () => {
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    payosInstance.paymentRequests.get.mockResolvedValue({ status: 'CANCELLED' })

    const result = await handleSubscriptionReturn({ orderCode: '123456' }, userId)

    expect(result.status).toBe('cancelled')
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled()
    expect(sub.save).toHaveBeenCalled()
  })

  it('returns pending and saves nothing when PayOS reports PROCESSING', async () => {
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    payosInstance.paymentRequests.get.mockResolvedValue({ status: 'PROCESSING' })

    const result = await handleSubscriptionReturn({ orderCode: '123456' }, userId)

    expect(result.status).toBe('pending')
    expect(sub.save).not.toHaveBeenCalled()
  })

  it('falls back to cancel=true query param when PayOS API call fails', async () => {
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    payosInstance.paymentRequests.get.mockRejectedValue(new Error('network'))

    const result = await handleSubscriptionReturn({ orderCode: '123456', cancel: 'true' }, userId)

    expect(result.status).toBe('cancelled')
  })

  it('falls back to code=00 query param when PayOS API call fails (→ completed)', async () => {
    const sub = makeSubOrder()
    subOrderModel.findOne.mockResolvedValue(sub)
    payosInstance.paymentRequests.get.mockRejectedValue(new Error('network'))
    userModel.findById.mockResolvedValue(makeUser(null))
    userModel.findByIdAndUpdate.mockResolvedValue({})

    const result = await handleSubscriptionReturn({ orderCode: '123456', code: '00' }, userId)

    expect(result.status).toBe('completed')
    expect(userModel.findByIdAndUpdate).toHaveBeenCalled()
  })
})

// =============================================================================
// getMySubscription
// =============================================================================
describe('getMySubscription', () => {
  it('returns isActive true and positive daysLeft for active VIP', async () => {
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(makeUser({ plan: 'monthly', expiresAt: futureDate(15) })),
    })

    const result = await getMySubscription(userId)

    expect(result.isActive).toBe(true)
    expect(result.plan).toBe('monthly')
    expect(result.daysLeft).toBeGreaterThan(0)
    expect(result.expiresAt).toBeInstanceOf(Date)
  })

  it('returns isActive false for expired VIP', async () => {
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(makeUser({ plan: 'monthly', expiresAt: pastDate(1) })),
    })

    const result = await getMySubscription(userId)

    expect(result.isActive).toBe(false)
    expect(result.plan).toBeNull()
    expect(result.expiresAt).toBeNull()
    expect(result.daysLeft).toBe(0)
  })

  it('returns isActive false when user has no VIP', async () => {
    userModel.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(makeUser(null)),
    })

    const result = await getMySubscription(userId)

    expect(result.isActive).toBe(false)
    expect(result.plan).toBeNull()
    expect(result.daysLeft).toBe(0)
  })
})

// =============================================================================
// _activateVip (via webhook) — VIP stack-up logic
// =============================================================================
describe('_activateVip — VIP stack-up logic', () => {
  const setupWebhookMocks = (vip) => {
    payosInstance.webhooks.verify.mockResolvedValue({ orderCode: 123456, code: '00' })
    subOrderModel.findOne.mockResolvedValue(makeSubOrder({ plan: 'monthly' }))
    userModel.findById.mockResolvedValue(makeUser(vip))
    userModel.findByIdAndUpdate.mockImplementation((_id, update) => Promise.resolve(update))
  }

  it('stacks up from currentExpiry when VIP is still active', async () => {
    setupWebhookMocks({ plan: 'monthly', expiresAt: futureDate(10) })

    let capturedUpdate
    userModel.findByIdAndUpdate.mockImplementation((_id, update) => {
      capturedUpdate = update
      return Promise.resolve({})
    })

    await handleSubscriptionWebhook({})

    const newExpiry = capturedUpdate['vip.expiresAt']
    const daysFromNow = (newExpiry - Date.now()) / 86_400_000
    // 10 days remaining + 30 new days = ~40 days
    expect(daysFromNow).toBeGreaterThan(35)
    expect(daysFromNow).toBeLessThan(45)
  })

  it('resets to today when VIP has already expired', async () => {
    setupWebhookMocks({ plan: 'monthly', expiresAt: pastDate(5) })

    let capturedUpdate
    userModel.findByIdAndUpdate.mockImplementation((_id, update) => {
      capturedUpdate = update
      return Promise.resolve({})
    })

    await handleSubscriptionWebhook({})

    const newExpiry = capturedUpdate['vip.expiresAt']
    const daysFromNow = (newExpiry - Date.now()) / 86_400_000
    // Should be ~30 days from now, not 25 (expired base)
    expect(daysFromNow).toBeGreaterThan(29)
    expect(daysFromNow).toBeLessThan(31)
  })
})

// =============================================================================
// requireVip middleware
// =============================================================================
describe('requireVip middleware', () => {
  const res = {}
  let next

  const makeReq = (overrides = {}) => ({
    user: { roles: [], vip: null, permissions: undefined, ...overrides },
  })

  beforeEach(() => {
    next = jest.fn()
  })

  it('passes for admin regardless of VIP status', async () => {
    const req = makeReq({ roles: ['admin'], vip: null })
    await requireVip(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(roleRepo.findByCodesWithPermissions).not.toHaveBeenCalled()
  })

  it('passes for user with active VIP (expiresAt in future)', async () => {
    const req = makeReq({ vip: { expiresAt: futureDate(10) } })
    await requireVip(req, res, next)

    expect(next).toHaveBeenCalledWith()
    expect(roleRepo.findByCodesWithPermissions).not.toHaveBeenCalled()
  })

  it('blocks user with expired VIP', async () => {
    roleRepo.findByCodesWithPermissions.mockResolvedValue([])
    const req = makeReq({ roles: ['member'], vip: { expiresAt: pastDate(1) } })
    await requireVip(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'VIP_REQUIRED' }))
  })

  it('blocks user with no VIP at all', async () => {
    roleRepo.findByCodesWithPermissions.mockResolvedValue([])
    const req = makeReq({ roles: ['member'], vip: null })
    await requireVip(req, res, next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'VIP_REQUIRED' }))
  })

  it('passes user with room_visualizer:use permission even without VIP', async () => {
    roleRepo.findByCodesWithPermissions.mockResolvedValue([
      { permissions: [{ key: 'room_visualizer:use' }] },
    ])
    const req = makeReq({ roles: ['member'], vip: null })
    await requireVip(req, res, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('uses cached permissions and skips DB lookup', async () => {
    const req = makeReq({ vip: null, roles: ['member'], permissions: ['room_visualizer:use'] })
    await requireVip(req, res, next)

    expect(roleRepo.findByCodesWithPermissions).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it('blocks user with irrelevant cached permissions', async () => {
    const req = makeReq({ vip: null, roles: ['member'], permissions: ['product:read'] })
    await requireVip(req, res, next)

    expect(roleRepo.findByCodesWithPermissions).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'VIP_REQUIRED' }))
  })
})
