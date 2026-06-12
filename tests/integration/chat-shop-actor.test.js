import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'
import { loginMember, loginShopOwner, createAndLogin, createUserWithToken } from '../setup/auth.js'
import { createSampleShop } from '../setup/factories.js'
import { ROLES } from '../../src/constants/role.constant.js'
import Shop from '../../src/models/shop.model.js'
import PERMISSIONS from '../../src/constants/permission.constant.js'

const api = env.apiPrefix

// ─── Helpers ─────────────────────────────────────────────────────────────────

const openShopConversation = async (memberToken, shopId) =>
  request(app)
    .post(`${api}/conversations/shop`)
    .set('Authorization', `Bearer ${memberToken}`)
    .send({ shopId: shopId.toString() })

const sendMsg = (token, conversationId, body) =>
  request(app)
    .post(`${api}/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ messageType: 'TEXT', ...body })

const listConversations = (token, query = {}) =>
  request(app)
    .get(`${api}/conversations`)
    .set('Authorization', `Bearer ${token}`)
    .query(query)

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await resetTestDatabase()
  await ensureRbacSeedData()
})

// ─── Customer sends as USER ───────────────────────────────────────────────────

describe('customer sends as USER in shop conversation', () => {
  it('creates conversation and sends message with default senderType=USER', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    expect(convRes.status).toBe(201)

    const convId = convRes.body.data.conversation._id
    const msgRes = await sendMsg(memberToken, convId, { content: 'Hi shop!' })

    expect(msgRes.status).toBe(201)
    expect(msgRes.body.data.message.senderType).toBe('USER')
    expect(msgRes.body.data.message.senderShopId).toBeNull()
    expect(msgRes.body.data.message.shopActor).toBeNull()
  })

  it('explicit actingAs=USER produces identical result', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(memberToken, convId, { content: 'Hi shop!', actingAs: 'USER' })

    expect(msgRes.status).toBe(201)
    expect(msgRes.body.data.message.senderType).toBe('USER')
  })
})

// ─── Shop owner replies as SHOP ───────────────────────────────────────────────

describe('shop owner replies as SHOP actor', () => {
  it('returns senderType=SHOP and senderShopId equal to the shop id', async () => {
    const { user: shopOwner, token: ownerToken } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(ownerToken, convId, {
      content: 'Shop reply',
      actingAs: 'SHOP',
      shopId: shop._id.toString(),
    })

    expect(msgRes.status).toBe(201)
    expect(msgRes.body.data.message.senderType).toBe('SHOP')
    expect(msgRes.body.data.message.senderShopId).toBe(shop._id.toString())
    expect(msgRes.body.data.message.shopActor).not.toBeNull()
    expect(msgRes.body.data.message.shopActor.id).toBe(shop._id.toString())
  })

  it('lastMessage in conversation reflects senderType=SHOP after shop reply', async () => {
    const { user: shopOwner, token: ownerToken } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    await sendMsg(ownerToken, convId, {
      content: 'Shop reply',
      actingAs: 'SHOP',
      shopId: shop._id.toString(),
    })

    const workspaceRes = await listConversations(ownerToken, {
      scope: 'workspace',
      shopId: shop._id.toString(),
    })

    expect(workspaceRes.status).toBe(200)
    const conv = workspaceRes.body.data.conversations[0]
    expect(conv.lastMessage.senderType).toBe('SHOP')
    expect(conv.lastMessage.senderShopId).toBe(shop._id.toString())
  })
})

// ─── Staff actor scenarios ────────────────────────────────────────────────────

describe('staff actor scenarios', () => {
  const createStaffWithPermission = async (shopId, permissions) => {
    const { user: staffUser, token } = await createAndLogin(ROLES.STAFF)
    const normalizedPermissions = Array.isArray(permissions) ? permissions : [permissions]
    await Shop.findByIdAndUpdate(shopId, {
      $push: {
        staff: staffUser._id,
        staffPermissions: { staffUser: staffUser._id, permissions: normalizedPermissions },
      },
    })
    return { staffUser, token }
  }

  const createStaffWithoutPermission = async (shopId) => {
    const { user: staffUser, token } = await createAndLogin(ROLES.STAFF)
    await Shop.findByIdAndUpdate(shopId, {
      $push: {
        staff: staffUser._id,
        staffPermissions: { staffUser: staffUser._id, permissions: [] },
      },
    })
    return { staffUser, token }
  }

  it('staff with shop:chat:send can reply as SHOP actor', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })
    const { token: staffToken } = await createStaffWithPermission(shop._id, [
      PERMISSIONS.SHOP_CHAT_READ,
      PERMISSIONS.SHOP_CHAT_SEND,
    ])

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(staffToken, convId, {
      content: 'Staff reply as shop',
      actingAs: 'SHOP',
      shopId: shop._id.toString(),
    })

    expect(msgRes.status).toBe(201)
    expect(msgRes.body.data.message.senderType).toBe('SHOP')
    expect(msgRes.body.data.message.senderShopId).toBe(shop._id.toString())
  })

  it('staff without shop chat permission is blocked from the conversation entirely', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })
    const { token: staffToken } = await createStaffWithoutPermission(shop._id)

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    // Cannot read messages
    const readRes = await request(app)
      .get(`${api}/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${staffToken}`)
    expect(readRes.status).toBe(403)

    // Cannot send messages
    const sendRes = await sendMsg(staffToken, convId, {
      content: 'Unauthorized reply',
      actingAs: 'SHOP',
      shopId: shop._id.toString(),
    })
    expect(sendRes.status).toBe(403)
  })

  it('staff with shop:chat:read can access workspace conversations list', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })
    const { token: staffToken } = await createStaffWithPermission(shop._id, PERMISSIONS.SHOP_CHAT_READ)

    await openShopConversation(memberToken, shop._id)

    const workspaceRes = await listConversations(staffToken, {
      scope: 'workspace',
      shopId: shop._id.toString(),
    })

    expect(workspaceRes.status).toBe(200)
    expect(workspaceRes.body.data.conversations).toHaveLength(1)
    expect(workspaceRes.body.data.conversations[0].context.actingAs).toBe('SHOP')
  })
})

// ─── ACL edge cases ───────────────────────────────────────────────────────────

describe('ACL edge cases', () => {
  it('unrelated user cannot send as USER in someone else shop conversation', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const { token: outsiderToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(outsiderToken, convId, { content: 'Intruder', actingAs: 'USER' })

    expect(msgRes.status).toBe(403)
  })

  it('shop owner cannot reply with wrong shopId (actingAs=SHOP, mismatched shopId)', async () => {
    const { user: ownerA, token: ownerAToken } = await loginShopOwner()
    const { user: ownerB } = await loginShopOwner()
    const { token: memberToken } = await loginMember()

    const shopA = await createSampleShop({ owner: ownerA._id })
    const shopB = await createSampleShop({ owner: ownerB._id })

    const convRes = await openShopConversation(memberToken, shopA._id)
    const convId = convRes.body.data.conversation._id

    // ownerA tries to use shopB's id for shopA's conversation
    const msgRes = await sendMsg(ownerAToken, convId, {
      content: 'Wrong shop',
      actingAs: 'SHOP',
      shopId: shopB._id.toString(),
    })

    expect(msgRes.status).toBe(403)
  })

  it('actingAs=SHOP requires shopId — validation rejects missing shopId with 422', async () => {
    const { user: shopOwner, token: ownerToken } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const convRes = await openShopConversation(memberToken, shop._id)
    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(ownerToken, convId, {
      content: 'No shopId provided',
      actingAs: 'SHOP',
      // shopId intentionally omitted
    })

    expect(msgRes.status).toBe(422)
  })

  it('actingAs=SHOP in a DIRECT conversation is rejected with 400', async () => {
    const { user: userA, token: tokenA } = await loginMember()
    const { user: userB } = await loginMember()

    const convRes = await request(app)
      .post(`${api}/conversations/direct`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ targetUserId: userB._id.toString() })

    const convId = convRes.body.data.conversation._id

    const msgRes = await sendMsg(tokenA, convId, {
      content: 'Wrong actor',
      actingAs: 'SHOP',
      shopId: userA._id.toString(), // arbitrary non-matching id
    })

    // type mismatch: SHOP actor in DIRECT conversation → 400
    expect(msgRes.status).toBe(400)
  })
})

// ─── scope=workspace query ─────────────────────────────────────────────────

describe('scope=workspace query', () => {
  it('returns only SHOP conversations for that shop', async () => {
    const { user: ownerA, token: tokenA } = await loginShopOwner()
    const { user: ownerB } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shopA = await createSampleShop({ owner: ownerA._id })
    const shopB = await createSampleShop({ owner: ownerB._id })

    // Member opens conversations with both shops
    await openShopConversation(memberToken, shopA._id)
    await openShopConversation(memberToken, shopB._id)

    const res = await listConversations(tokenA, { scope: 'workspace', shopId: shopA._id.toString() })

    expect(res.status).toBe(200)
    expect(res.body.data.conversations).toHaveLength(1)
    // All returned conversations belong to shopA
    for (const conv of res.body.data.conversations) {
      const sid = conv.shopId?._id || conv.shopId
      expect(sid.toString()).toBe(shopA._id.toString())
    }
  })

  it('scope=workspace without shopId returns 422', async () => {
    const { token: ownerToken } = await loginShopOwner()

    const res = await listConversations(ownerToken, { scope: 'workspace' })

    expect(res.status).toBe(422)
  })

  it('unauthenticated request is rejected with 401', async () => {
    const res = await request(app).get(`${api}/conversations`)

    expect(res.status).toBe(401)
  })
})
