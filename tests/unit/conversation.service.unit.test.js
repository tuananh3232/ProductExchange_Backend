import { jest } from '@jest/globals'
import PERMISSIONS from '../../src/constants/permission.constant.js'
import { ROLES } from '../../src/constants/role.constant.js'

// ─── Mocks (must be set up before any await import of the module under test) ───

const conversationRepo = {
  findById: jest.fn(),
  findMany: jest.fn(),
  countMany: jest.fn(),
  create: jest.fn(),
  findDirectByParticipantKey: jest.fn(),
  findShopByCustomerKey: jest.fn(),
  updateById: jest.fn(),
}

const messageRepo = {
  findMany: jest.fn(),
  countMany: jest.fn(),
  create: jest.fn(),
  markConversationAsRead: jest.fn(),
}

const userModel = { findById: jest.fn() }
const shopModel = { findById: jest.fn() }
const notifySafely = jest.fn()

jest.unstable_mockModule('../../src/repositories/conversation/conversation.repository.js', () => conversationRepo)
jest.unstable_mockModule('../../src/repositories/conversation/message.repository.js', () => messageRepo)
jest.unstable_mockModule('../../src/models/user.model.js', () => ({ default: userModel }))
jest.unstable_mockModule('../../src/models/shop.model.js', () => ({ default: shopModel }))
jest.unstable_mockModule('../../src/services/notification/notification.service.js', () => ({ notifySafely }))

const service = await import('../../src/services/conversation/conversation.service.js')

// ─── Fixtures ───────────────────────────────────────────────────────────────

const oid = (n) => `665f1f77bcf86cd79943${String(n).padStart(4, '0')}`.slice(0, 24)

const OWNER_ID    = oid(1)
const CUSTOMER_ID = oid(2)
const SHOP_ID     = oid(3)
const STAFF_ID    = oid(4)
const OUTSIDER_ID = oid(5)
const CONV_ID     = oid(6)
const MSG_ID      = oid(7)

// Chainable select mock used to simulate Model.findById(...).select(...)
const selectWith = (value) => ({ select: jest.fn().mockResolvedValue(value) })

const makeShop = (overrides = {}) => ({
  _id: SHOP_ID,
  owner: OWNER_ID,
  staff: [],
  staffPermissions: [],
  isActive: true,
  ...overrides,
})

// Simulates the already-populated conversation document returned by conversationRepo.findById
const makeDirectConv = (overrides = {}) => ({
  _id: CONV_ID,
  type: 'DIRECT',
  participants: [OWNER_ID, CUSTOMER_ID],
  shopId: null,
  customerId: null,
  isActive: true,
  ...overrides,
})

const makeShopConv = (overrides = {}) => ({
  _id: CONV_ID,
  type: 'SHOP',
  participants: [],
  // shopId is a populated Shop-like object (as returned after populateConversation)
  shopId: { _id: SHOP_ID, owner: OWNER_ID, staff: [], staffPermissions: [] },
  customerId: CUSTOMER_ID,
  isActive: true,
  ...overrides,
})

const user = (id, roles = [ROLES.MEMBER]) => ({ _id: id, roles })

const makeMsg = (overrides = {}) => ({
  _id: MSG_ID,
  conversationId: CONV_ID,
  senderId: OWNER_ID,
  senderType: 'USER',
  senderUserId: OWNER_ID,
  senderShopId: null,
  content: 'hello',
  messageType: 'TEXT',
  attachments: [],
  readBy: [],
  createdAt: new Date(),
  ...overrides,
})

const pagination = { page: 1, limit: 10, skip: 0, sortBy: 'updatedAt', sortOrder: -1 }

beforeEach(() => jest.clearAllMocks())

// ─── canAccessConversation ───────────────────────────────────────────────────

describe('canAccessConversation', () => {
  it('returns false when userContext is null', async () => {
    expect(await service.canAccessConversation(null, makeDirectConv())).toBe(false)
  })

  it('returns false when conversation is null', async () => {
    expect(await service.canAccessConversation(user(OWNER_ID), null)).toBe(false)
  })

  it('admin bypasses all access checks', async () => {
    expect(await service.canAccessConversation(user(OUTSIDER_ID, [ROLES.ADMIN]), makeDirectConv())).toBe(true)
  })

  describe('DIRECT conversation', () => {
    it('participant can access', async () => {
      expect(await service.canAccessConversation(user(OWNER_ID), makeDirectConv())).toBe(true)
    })

    it('non-participant is denied', async () => {
      expect(await service.canAccessConversation(user(OUTSIDER_ID), makeDirectConv())).toBe(false)
    })
  })

  describe('SHOP conversation', () => {
    it('customerId can access without DB call', async () => {
      expect(await service.canAccessConversation(user(CUSTOMER_ID), makeShopConv())).toBe(true)
      expect(shopModel.findById).not.toHaveBeenCalled()
    })

    it('shop owner can access', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop()))
      expect(await service.canAccessConversation(user(OWNER_ID), makeShopConv())).toBe(true)
    })

    it('staff with shop:chat:read can access', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop({
        staff: [STAFF_ID],
        staffPermissions: [{ staffUser: STAFF_ID, permissions: [PERMISSIONS.SHOP_CHAT_READ] }],
      })))
      expect(await service.canAccessConversation(user(STAFF_ID), makeShopConv())).toBe(true)
    })

    it('staff without shop:chat:read is denied', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop({
        staff: [STAFF_ID],
        staffPermissions: [{ staffUser: STAFF_ID, permissions: [] }],
      })))
      expect(await service.canAccessConversation(user(STAFF_ID), makeShopConv())).toBe(false)
    })

    it('staff listed in shop.staff but missing from staffPermissions is denied', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop({
        staff: [STAFF_ID],
        staffPermissions: [], // no entry at all
      })))
      expect(await service.canAccessConversation(user(STAFF_ID), makeShopConv())).toBe(false)
    })

    it('unrelated user is denied', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop()))
      expect(await service.canAccessConversation(user(OUTSIDER_ID), makeShopConv())).toBe(false)
    })
  })
})

// ─── assertConversationActorAccess ─────────────────────────────────────────

describe('assertConversationActorAccess', () => {
  describe('actingAs=USER', () => {
    it('participant in DIRECT conversation gets USER actor', async () => {
      const actor = await service.assertConversationActorAccess(
        user(OWNER_ID), makeDirectConv(), { actingAs: 'USER' }
      )
      expect(actor.senderType).toBe('USER')
      expect(actor.senderUserId).toBe(OWNER_ID)
      expect(actor.senderShopId).toBeNull()
    })

    it('defaults actingAs to USER when omitted', async () => {
      const actor = await service.assertConversationActorAccess(
        user(OWNER_ID), makeDirectConv(), {}
      )
      expect(actor.senderType).toBe('USER')
    })

    it('non-participant in DIRECT throws 403', async () => {
      await expect(
        service.assertConversationActorAccess(user(OUTSIDER_ID), makeDirectConv(), { actingAs: 'USER' })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('customerId in SHOP conversation gets USER actor', async () => {
      const actor = await service.assertConversationActorAccess(
        user(CUSTOMER_ID), makeShopConv(), { actingAs: 'USER' }
      )
      expect(actor.senderType).toBe('USER')
      expect(actor.senderShopId).toBeNull()
    })

    it('non-customer trying actingAs=USER in SHOP conversation throws 403', async () => {
      await expect(
        service.assertConversationActorAccess(user(OUTSIDER_ID), makeShopConv(), { actingAs: 'USER' })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('admin can reply as USER in any conversation type', async () => {
      const actor = await service.assertConversationActorAccess(
        user(OUTSIDER_ID, [ROLES.ADMIN]), makeShopConv(), { actingAs: 'USER' }
      )
      expect(actor.senderType).toBe('USER')
    })
  })

  describe('actingAs=SHOP', () => {
    it('shop owner actingAs=SHOP gets SHOP actor with senderShopId', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop()))
      const actor = await service.assertConversationActorAccess(
        user(OWNER_ID), makeShopConv(), { actingAs: 'SHOP', shopId: SHOP_ID }
      )
      expect(actor.senderType).toBe('SHOP')
      expect(actor.senderShopId).toBe(SHOP_ID)
      expect(actor.senderUserId).toBe(OWNER_ID)
    })

    it('staff with shop:chat:send actingAs=SHOP gets SHOP actor', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop({
        staff: [STAFF_ID],
        staffPermissions: [{ staffUser: STAFF_ID, permissions: [PERMISSIONS.SHOP_CHAT_SEND] }],
      })))
      const actor = await service.assertConversationActorAccess(
        user(STAFF_ID), makeShopConv(), { actingAs: 'SHOP', shopId: SHOP_ID }
      )
      expect(actor.senderType).toBe('SHOP')
      expect(actor.senderShopId).toBe(SHOP_ID)
    })

    it('staff without shop:chat:send actingAs=SHOP throws 403', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop({
        staff: [STAFF_ID],
        staffPermissions: [{ staffUser: STAFF_ID, permissions: [] }],
      })))
      await expect(
        service.assertConversationActorAccess(user(STAFF_ID), makeShopConv(), { actingAs: 'SHOP', shopId: SHOP_ID })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('unrelated user actingAs=SHOP throws 403', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop()))
      await expect(
        service.assertConversationActorAccess(user(OUTSIDER_ID), makeShopConv(), { actingAs: 'SHOP', shopId: SHOP_ID })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('actingAs=SHOP in DIRECT conversation throws 400', async () => {
      await expect(
        service.assertConversationActorAccess(user(OWNER_ID), makeDirectConv(), { actingAs: 'SHOP', shopId: SHOP_ID })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('actingAs=SHOP with missing shopId throws 403', async () => {
      await expect(
        service.assertConversationActorAccess(user(OWNER_ID), makeShopConv(), { actingAs: 'SHOP', shopId: null })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('actingAs=SHOP with mismatched shopId throws 403', async () => {
      const wrongShopId = oid(99)
      await expect(
        service.assertConversationActorAccess(user(OWNER_ID), makeShopConv(), { actingAs: 'SHOP', shopId: wrongShopId })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('admin actingAs=SHOP bypasses hasShopChatPermission check', async () => {
      shopModel.findById.mockReturnValue(selectWith(makeShop())) // owner=OWNER_ID, not OUTSIDER
      const actor = await service.assertConversationActorAccess(
        user(OUTSIDER_ID, [ROLES.ADMIN]), makeShopConv(), { actingAs: 'SHOP', shopId: SHOP_ID }
      )
      expect(actor.senderType).toBe('SHOP')
    })
  })
})

// ─── sendMessage — actor field propagation ───────────────────────────────────

describe('sendMessage actor field propagation', () => {
  const setupSend = ({ conv, msgOverrides = {} }) => {
    conversationRepo.findById.mockResolvedValue(conv)
    conversationRepo.updateById.mockResolvedValue(conv)
    const msg = makeMsg(msgOverrides)
    messageRepo.create.mockResolvedValue(msg)
    messageRepo.findMany.mockResolvedValue([msg])
    notifySafely.mockResolvedValue(undefined)
    return msg
  }

  it('USER actor → messageRepo.create receives senderType=USER and senderShopId=null', async () => {
    setupSend({ conv: makeDirectConv() })

    await service.sendMessage(user(OWNER_ID), {
      conversationId: CONV_ID,
      content: 'hello',
      messageType: 'TEXT',
      attachments: [],
      actingAs: 'USER',
      shopId: null,
    })

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ senderType: 'USER', senderShopId: null })
    )
  })

  it('USER actor → normalizeMessage result has senderType=USER and shopActor=null', async () => {
    setupSend({ conv: makeDirectConv() })

    const result = await service.sendMessage(user(OWNER_ID), {
      conversationId: CONV_ID,
      content: 'hello',
      messageType: 'TEXT',
      attachments: [],
      actingAs: 'USER',
    })

    expect(result.senderType).toBe('USER')
    expect(result.senderShopId).toBeNull()
    expect(result.shopActor).toBeNull()
  })

  it('SHOP actor → messageRepo.create receives senderType=SHOP and senderShopId set', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop()))

    const conv = makeShopConv()
    setupSend({
      conv,
      msgOverrides: {
        senderType: 'SHOP',
        senderUserId: OWNER_ID,
        senderShopId: { _id: SHOP_ID, name: 'Test Shop', slug: 'test-shop', logo: null },
      },
    })

    await service.sendMessage(user(OWNER_ID), {
      conversationId: CONV_ID,
      content: 'Shop reply',
      messageType: 'TEXT',
      attachments: [],
      actingAs: 'SHOP',
      shopId: SHOP_ID,
    })

    expect(messageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        senderType: 'SHOP',
        senderShopId: expect.anything(), // ObjectId — not null
      })
    )
  })

  it('SHOP actor → normalizeMessage result has senderType=SHOP and shopActor populated', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop()))

    const conv = makeShopConv()
    setupSend({
      conv,
      msgOverrides: {
        senderType: 'SHOP',
        senderUserId: OWNER_ID,
        senderShopId: { _id: SHOP_ID, name: 'Test Shop', slug: 'test-shop', logo: null },
      },
    })

    const result = await service.sendMessage(user(OWNER_ID), {
      conversationId: CONV_ID,
      content: 'Shop reply',
      messageType: 'TEXT',
      attachments: [],
      actingAs: 'SHOP',
      shopId: SHOP_ID,
    })

    expect(result.senderType).toBe('SHOP')
    expect(result.senderShopId).toBe(SHOP_ID)
    expect(result.shopActor).not.toBeNull()
    expect(result.shopActor.id).toBe(SHOP_ID)
  })

  it('SHOP actor → lastMessage update includes senderType=SHOP and senderShopId', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop()))
    setupSend({
      conv: makeShopConv(),
      msgOverrides: { senderType: 'SHOP', senderUserId: OWNER_ID, senderShopId: null },
    })

    await service.sendMessage(user(OWNER_ID), {
      conversationId: CONV_ID,
      content: 'Shop reply',
      messageType: 'TEXT',
      attachments: [],
      actingAs: 'SHOP',
      shopId: SHOP_ID,
    })

    expect(conversationRepo.updateById).toHaveBeenCalledWith(
      CONV_ID,
      expect.objectContaining({
        lastMessage: expect.objectContaining({ senderType: 'SHOP' }),
      })
    )
  })

  it('empty content with no attachments throws 400', async () => {
    conversationRepo.findById.mockResolvedValue(makeDirectConv())

    await expect(
      service.sendMessage(user(OWNER_ID), {
        conversationId: CONV_ID,
        content: '',
        messageType: 'TEXT',
        attachments: [],
        actingAs: 'USER',
      })
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(messageRepo.create).not.toHaveBeenCalled()
  })
})

// ─── getConversations scope ──────────────────────────────────────────────────

describe('getConversations', () => {
  beforeEach(() => {
    conversationRepo.findMany.mockResolvedValue([])
    conversationRepo.countMany.mockResolvedValue(0)
    messageRepo.countMany.mockResolvedValue(0)
  })

  it('scope=main builds $or filter for DIRECT and SHOP conversations', async () => {
    await service.getConversations(user(CUSTOMER_ID), pagination, { scope: 'main' })

    const { filter } = conversationRepo.findMany.mock.calls[0][0]
    expect(filter.$or).toHaveLength(2)
    expect(filter.$or[0].type).toBe('DIRECT')
    expect(filter.$or[1].type).toBe('SHOP')
    expect(filter.$or[1].customerId).toBe(CUSTOMER_ID)
    expect(filter.type).toBeUndefined()
  })

  it('scope=main sets context.actingAs=USER', async () => {
    const conv = makeDirectConv()
    conversationRepo.findMany.mockResolvedValue([conv])
    conversationRepo.countMany.mockResolvedValue(1)

    const { conversations } = await service.getConversations(user(OWNER_ID), pagination, { scope: 'main' })

    expect(conversations[0].context.actingAs).toBe('USER')
    expect(conversations[0].context.shopId).toBeNull()
  })

  it('scope=workspace builds {type:SHOP, shopId} filter without $or', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop()))

    await service.getConversations(user(OWNER_ID), pagination, { scope: 'workspace', shopId: SHOP_ID })

    const { filter } = conversationRepo.findMany.mock.calls[0][0]
    expect(filter.type).toBe('SHOP')
    expect(filter.shopId).toBe(SHOP_ID)
    expect(filter.$or).toBeUndefined()
  })

  it('scope=workspace sets context.actingAs=SHOP on each conversation', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop()))
    conversationRepo.findMany.mockResolvedValue([makeShopConv()])
    conversationRepo.countMany.mockResolvedValue(1)

    const { conversations } = await service.getConversations(
      user(OWNER_ID), pagination, { scope: 'workspace', shopId: SHOP_ID }
    )

    expect(conversations[0].context.actingAs).toBe('SHOP')
    expect(conversations[0].context.shopId).toBe(SHOP_ID)
  })

  it('scope=workspace throws 403 for user without shop:chat:read', async () => {
    shopModel.findById.mockReturnValue(selectWith(makeShop())) // owner=OWNER_ID only

    await expect(
      service.getConversations(user(OUTSIDER_ID), pagination, { scope: 'workspace', shopId: SHOP_ID })
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(conversationRepo.findMany).not.toHaveBeenCalled()
  })
})
