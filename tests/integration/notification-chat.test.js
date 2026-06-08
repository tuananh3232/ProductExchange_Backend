import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'
import { loginMember, loginShopOwner } from '../setup/auth.js'
import { createSampleShop } from '../setup/factories.js'
import Notification from '../../src/models/notification.model.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../src/constants/notification.constant.js'

const api = env.apiPrefix

const createNotification = (recipient, overrides = {}) =>
  Notification.create({
    recipient,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: 'Test notification',
    message: 'Notification created by integration test',
    targetType: NOTIFICATION_TARGET_TYPES.SYSTEM,
    isRead: false,
    ...overrides,
  })

beforeEach(async () => {
  await resetTestDatabase()
  await ensureRbacSeedData()
})

describe('notification and chat integration', () => {
  it('lets a user list their notifications and unread count', async () => {
    const { user, token } = await loginMember()
    await createNotification(user._id)

    const listResponse = await request(app)
      .get(`${api}/notifications`)
      .set('Authorization', `Bearer ${token}`)

    const countResponse = await request(app)
      .get(`${api}/notifications/unread-count`)
      .set('Authorization', `Bearer ${token}`)

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data.notifications).toHaveLength(1)
    expect(listResponse.body.data.unreadCount).toBe(1)
    expect(countResponse.status).toBe(200)
    expect(countResponse.body.data.unreadCount).toBe(1)
  })

  it('marks one notification as read', async () => {
    const { user, token } = await loginMember()
    const notification = await createNotification(user._id)

    const response = await request(app)
      .patch(`${api}/notifications/${notification._id}/read`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.notification.isRead).toBe(true)
    expect(response.body.data.notification.readAt).toBeTruthy()
  })

  it('marks all notifications as read and deletes a notification', async () => {
    const { user, token } = await loginMember()
    const notification = await createNotification(user._id)
    await createNotification(user._id)

    const readAllResponse = await request(app)
      .patch(`${api}/notifications/read-all`)
      .set('Authorization', `Bearer ${token}`)

    const deleteResponse = await request(app)
      .delete(`${api}/notifications/${notification._id}`)
      .set('Authorization', `Bearer ${token}`)

    const remaining = await Notification.find({ recipient: user._id })

    expect(readAllResponse.status).toBe(200)
    expect(deleteResponse.status).toBe(200)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].isRead).toBe(true)
  })

  it('creates a direct conversation and sends a text message', async () => {
    const { user: targetUser } = await loginMember()
    const { token } = await loginMember()

    const conversationResponse = await request(app)
      .post(`${api}/conversations/direct`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserId: targetUser._id.toString() })

    const conversationId = conversationResponse.body.data.conversation._id
    const messageResponse = await request(app)
      .post(`${api}/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello from integration test', messageType: 'TEXT' })

    expect(conversationResponse.status).toBe(201)
    expect(messageResponse.status).toBe(201)
    expect(messageResponse.body.data.message.content).toBe('Hello from integration test')
  })

  it('creates a shop conversation when the endpoint exists', async () => {
    const { user: shopOwner } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const response = await request(app)
      .post(`${api}/conversations/shop`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ shopId: shop._id.toString() })

    expect(response.status).toBe(201)
    expect((response.body.data.conversation.shopId._id || response.body.data.conversation.shopId).toString()).toBe(
      shop._id.toString()
    )
  })

  it('lets a shop owner reply as the shop actor and list workspace conversations', async () => {
    const { user: shopOwner, token: ownerToken } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const shop = await createSampleShop({ owner: shopOwner._id })

    const conversationResponse = await request(app)
      .post(`${api}/conversations/shop`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ shopId: shop._id.toString() })

    const conversationId = conversationResponse.body.data.conversation._id
    const messageResponse = await request(app)
      .post(`${api}/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        content: 'Shop reply from integration test',
        messageType: 'TEXT',
        actingAs: 'SHOP',
        shopId: shop._id.toString(),
      })

    const workspaceResponse = await request(app)
      .get(`${api}/conversations`)
      .query({ scope: 'workspace', shopId: shop._id.toString() })
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(messageResponse.status).toBe(201)
    expect(messageResponse.body.data.message.senderType).toBe('SHOP')
    expect(messageResponse.body.data.message.senderShopId).toBe(shop._id.toString())
    expect(workspaceResponse.status).toBe(200)
    expect(workspaceResponse.body.data.conversations).toHaveLength(1)
    expect(workspaceResponse.body.data.conversations[0].context.actingAs).toBe('SHOP')
    expect(workspaceResponse.body.data.conversations[0].lastMessage.senderType).toBe('SHOP')
  })

  it('prevents a different shop from replying to another shop conversation', async () => {
    const { user: firstOwner } = await loginShopOwner()
    const { user: secondOwner, token: secondOwnerToken } = await loginShopOwner()
    const { token: memberToken } = await loginMember()
    const firstShop = await createSampleShop({ owner: firstOwner._id })
    const secondShop = await createSampleShop({ owner: secondOwner._id })

    const conversationResponse = await request(app)
      .post(`${api}/conversations/shop`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ shopId: firstShop._id.toString() })

    const response = await request(app)
      .post(`${api}/conversations/${conversationResponse.body.data.conversation._id}/messages`)
      .set('Authorization', `Bearer ${secondOwnerToken}`)
      .send({
        content: 'Wrong shop reply',
        messageType: 'TEXT',
        actingAs: 'SHOP',
        shopId: secondShop._id.toString(),
      })

    expect(response.status).toBe(403)
  })

  it('prevents a non-participant from reading conversation messages', async () => {
    const { user: targetUser } = await loginMember()
    const { token: participantToken } = await loginMember()
    const { token: outsiderToken } = await loginMember()
    const conversationResponse = await request(app)
      .post(`${api}/conversations/direct`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ targetUserId: targetUser._id.toString() })

    const response = await request(app)
      .get(`${api}/conversations/${conversationResponse.body.data.conversation._id}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`)

    expect(response.status).toBe(403)
  })
})
