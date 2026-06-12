import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'
import { loginMember, loginShopOwner } from '../setup/auth.js'
import { createSampleShop } from '../setup/factories.js'
import Notification from '../../src/models/notification.model.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../src/constants/notification.constant.js'
import {
  createManyNotifications,
  createNotification as createNotificationService
} from '../../src/services/notification/notification.service.js'

const api = env.apiPrefix

const navigationCases = [
  {
    types: [
      NOTIFICATION_TYPES.CHAT_NEW_MESSAGE,
      NOTIFICATION_TYPES.CHAT_NEW_IMAGE,
      NOTIFICATION_TYPES.CHAT_NEW_FILE,
      NOTIFICATION_TYPES.CHAT_CONVERSATION_CREATED,
      NOTIFICATION_TYPES.CHAT_REPORTED,
      NOTIFICATION_TYPES.CHAT_BLOCKED
    ],
    field: 'conversationId',
    targetType: NOTIFICATION_TARGET_TYPES.CHAT,
    path: 'chats'
  },
  {
    types: [
      NOTIFICATION_TYPES.ORDER_CREATED,
      NOTIFICATION_TYPES.ORDER_CONFIRMED,
      NOTIFICATION_TYPES.ORDER_REJECTED,
      NOTIFICATION_TYPES.ORDER_PREPARING,
      NOTIFICATION_TYPES.ORDER_SHIPPING,
      NOTIFICATION_TYPES.ORDER_DELIVERED,
      NOTIFICATION_TYPES.ORDER_CANCELLED_BY_BUYER,
      NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER,
      NOTIFICATION_TYPES.ORDER_REFUND_REQUESTED,
      NOTIFICATION_TYPES.ORDER_REFUND_APPROVED,
      NOTIFICATION_TYPES.ORDER_REFUND_REJECTED,
      NOTIFICATION_TYPES.ORDER_REVIEW_REQUIRED,
      NOTIFICATION_TYPES.PAYMENT_REFUNDED
    ],
    field: 'orderId',
    targetType: NOTIFICATION_TARGET_TYPES.ORDER,
    path: 'orders'
  },
  {
    types: [
      NOTIFICATION_TYPES.PRODUCT_APPROVED,
      NOTIFICATION_TYPES.PRODUCT_REJECTED,
      NOTIFICATION_TYPES.PRODUCT_BLOCKED,
      NOTIFICATION_TYPES.PRODUCT_UNBLOCKED,
      NOTIFICATION_TYPES.PRODUCT_OUT_OF_STOCK,
      NOTIFICATION_TYPES.PRODUCT_LOW_STOCK,
      NOTIFICATION_TYPES.PRODUCT_REPORTED,
      NOTIFICATION_TYPES.PRODUCT_REVIEWED,
      NOTIFICATION_TYPES.PRODUCT_WISHLISTED,
      NOTIFICATION_TYPES.PRODUCT_PRICE_DROPPED
    ],
    field: 'productId',
    targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
    path: 'products'
  },
  {
    types: [
      NOTIFICATION_TYPES.SHOP_APPROVED,
      NOTIFICATION_TYPES.SHOP_REJECTED,
      NOTIFICATION_TYPES.SHOP_BLOCKED,
      NOTIFICATION_TYPES.SHOP_UNBLOCKED,
      NOTIFICATION_TYPES.SHOP_UPDATE_REQUIRED,
      NOTIFICATION_TYPES.SHOP_STAFF_INVITED,
      NOTIFICATION_TYPES.SHOP_STAFF_ACCEPTED,
      NOTIFICATION_TYPES.SHOP_STAFF_REMOVED,
      NOTIFICATION_TYPES.SHOP_OWNERSHIP_TRANSFERRED,
      NOTIFICATION_TYPES.SHOP_STAFF_ROLE_UPDATED
    ],
    field: 'shopId',
    targetType: NOTIFICATION_TARGET_TYPES.SHOP,
    path: 'shops'
  },
  {
    types: [
      NOTIFICATION_TYPES.KYC_SUBMITTED,
      NOTIFICATION_TYPES.KYC_APPROVED,
      NOTIFICATION_TYPES.KYC_REJECTED,
      NOTIFICATION_TYPES.KYC_UPDATE_REQUIRED
    ],
    field: 'userId',
    targetType: NOTIFICATION_TARGET_TYPES.KYC,
    targetUrl: '/profile'
  },
  {
    types: [NOTIFICATION_TYPES.PAYMENT_SUCCESS, NOTIFICATION_TYPES.PAYMENT_FAILED],
    field: 'paymentId',
    extraField: 'orderId',
    targetType: NOTIFICATION_TARGET_TYPES.PAYMENT,
    path: 'orders',
    urlField: 'orderId'
  },
  {
    types: [NOTIFICATION_TYPES.PAYOUT_RECEIVED],
    field: 'walletId',
    extraField: 'withdrawalId',
    targetType: NOTIFICATION_TARGET_TYPES.WALLET,
    targetUrl: '/wallet'
  },
  {
    types: [
      NOTIFICATION_TYPES.SELLER_ROLE_GRANTED,
      NOTIFICATION_TYPES.SELLER_ROLE_REVOKED,
      NOTIFICATION_TYPES.USER_WARNED,
      NOTIFICATION_TYPES.USER_BLOCKED,
      NOTIFICATION_TYPES.USER_UNBLOCKED,
      NOTIFICATION_TYPES.SECURITY_PASSWORD_CHANGED,
      NOTIFICATION_TYPES.SECURITY_LOGIN_ALERT,
      NOTIFICATION_TYPES.EMAIL_VERIFIED
    ],
    field: 'userId',
    targetType: NOTIFICATION_TARGET_TYPES.USER,
    targetUrl: '/profile'
  },
  {
    types: [NOTIFICATION_TYPES.REPORT_CREATED, NOTIFICATION_TYPES.REPORT_RESOLVED],
    field: 'reportId',
    targetType: NOTIFICATION_TARGET_TYPES.REPORT,
    path: 'reports'
  },
  {
    types: [
      NOTIFICATION_TYPES.REVIEW_CREATED,
      NOTIFICATION_TYPES.REVIEW_REPLIED,
      NOTIFICATION_TYPES.REVIEW_HIDDEN,
      NOTIFICATION_TYPES.REVIEW_REPORTED
    ],
    field: 'reviewId',
    targetType: NOTIFICATION_TARGET_TYPES.REVIEW,
    path: 'reviews'
  },
  {
    types: [NOTIFICATION_TYPES.VOUCHER_CREATED, NOTIFICATION_TYPES.VOUCHER_EXPIRING],
    field: 'voucherId',
    targetType: NOTIFICATION_TARGET_TYPES.VOUCHER,
    path: 'vouchers'
  },
  {
    types: [NOTIFICATION_TYPES.FLASH_SALE_STARTED, NOTIFICATION_TYPES.FLASH_SALE_ENDING_SOON],
    field: 'flashSaleId',
    targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
    path: 'flash-sales'
  },
  {
    types: [NOTIFICATION_TYPES.COMBO_RECOMMENDED],
    field: 'comboId',
    targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
    path: 'combos'
  },
  {
    types: [NOTIFICATION_TYPES.SYSTEM_MAINTENANCE, NOTIFICATION_TYPES.SYSTEM_POLICY_UPDATED, NOTIFICATION_TYPES.SYSTEM],
    targetType: NOTIFICATION_TARGET_TYPES.NOTIFICATION,
    targetUrl: '/notifications'
  }
]

const navigationByType = new Map(navigationCases.flatMap((item) => item.types.map((type) => [type, item])))

const createNotification = (recipient, overrides = {}) =>
  Notification.create({
    recipient,
    type: NOTIFICATION_TYPES.SYSTEM,
    title: 'Test notification',
    message: 'Notification created by integration test',
    targetType: NOTIFICATION_TARGET_TYPES.SYSTEM,
    isRead: false,
    ...overrides
  })

beforeEach(async () => {
  await resetTestDatabase()
  await ensureRbacSeedData()
})

describe('notification and chat integration', () => {
  it('lets a user list their notifications and unread count', async () => {
    const { user, token } = await loginMember()
    await createNotification(user._id)

    const listResponse = await request(app).get(`${api}/notifications`).set('Authorization', `Bearer ${token}`)

    const countResponse = await request(app)
      .get(`${api}/notifications/unread-count`)
      .set('Authorization', `Bearer ${token}`)

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data.notifications).toHaveLength(1)
    expect(listResponse.body.data.unreadCount).toBe(1)
    expect(countResponse.status).toBe(200)
    expect(countResponse.body.data.unreadCount).toBe(1)
  })

  it('returns normalized navigation fields for created notifications', async () => {
    const { user, token } = await loginMember()
    const productId = user._id

    await createNotificationService({
      recipient: user._id,
      type: NOTIFICATION_TYPES.PRODUCT_APPROVED,
      title: 'Product approved',
      message: 'Product can be opened from notification',
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: productId,
      data: { productId }
    })

    const response = await request(app).get(`${api}/notifications`).set('Authorization', `Bearer ${token}`)

    const [notification] = response.body.data.notifications

    expect(response.status).toBe(200)
    expect(notification.targetType).toBe(NOTIFICATION_TARGET_TYPES.PRODUCT)
    expect(notification.targetId).toBe(productId.toString())
    expect(notification.targetUrl).toBe(`/products/${productId}`)
    expect(notification.metadata.productId).toBe(productId.toString())
  })

  it('returns click-through navigation fields for every notification type', async () => {
    const { user, token } = await loginMember()
    const id = user._id
    const types = Object.values(NOTIFICATION_TYPES)

    expect(navigationByType.size).toBe(types.length)

    await createManyNotifications(
      types.map((type) => {
        const navigation = navigationByType.get(type)
        const data = {}

        if (navigation.field) data[navigation.field] = id
        if (navigation.extraField) data[navigation.extraField] = id

        return {
          recipient: user._id,
          type,
          title: `${type} title`,
          message: `${type} message`,
          data
        }
      })
    )

    const response = await request(app)
      .get(`${api}/notifications`)
      .query({ limit: 100 })
      .set('Authorization', `Bearer ${token}`)

    const notificationsByType = new Map(
      response.body.data.notifications.map((notification) => [notification.type, notification])
    )

    expect(response.status).toBe(200)
    expect(notificationsByType.size).toBe(types.length)

    for (const type of types) {
      const navigation = navigationByType.get(type)
      const notification = notificationsByType.get(type)
      const expectedTargetUrl = navigation.targetUrl || `/${navigation.path}/${id}`

      expect(notification.targetType).toBe(navigation.targetType)
      expect(notification.targetUrl).toBe(expectedTargetUrl)
      expect(notification.actionUrl).toBe(expectedTargetUrl)

      if (navigation.field) {
        expect(notification.metadata[navigation.field]).toBe(id.toString())
      }
      if (navigation.extraField) {
        expect(notification.metadata[navigation.extraField]).toBe(id.toString())
      }
    }
  })

  it('does not crash when a legacy notification has no targetUrl', async () => {
    const { user, token } = await loginMember()

    await Notification.create({
      recipient: user._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Legacy notification',
      message: 'Notification without navigation fields',
      targetType: NOTIFICATION_TARGET_TYPES.SYSTEM,
      isRead: false
    })

    const response = await request(app).get(`${api}/notifications`).set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.notifications[0].targetUrl).toBeNull()
    expect(response.body.data.notifications[0].metadata).toEqual({})
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
    const { user: targetUser, token: targetToken } = await loginMember()
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

    const notificationResponse = await request(app)
      .get(`${api}/notifications`)
      .set('Authorization', `Bearer ${targetToken}`)

    const [notification] = notificationResponse.body.data.notifications

    expect(conversationResponse.status).toBe(201)
    expect(messageResponse.status).toBe(201)
    expect(messageResponse.body.data.message.content).toBe('Hello from integration test')
    expect(notificationResponse.status).toBe(200)
    expect(notification.type).toBe(NOTIFICATION_TYPES.CHAT_NEW_MESSAGE)
    expect(notification.targetType).toBe(NOTIFICATION_TARGET_TYPES.CHAT)
    expect(notification.targetId).toBe(conversationId)
    expect(notification.targetUrl).toBe(`/chats/${conversationId}`)
    expect(notification.actionUrl).toBe(`/chats/${conversationId}`)
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
        shopId: shop._id.toString()
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
        shopId: secondShop._id.toString()
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
