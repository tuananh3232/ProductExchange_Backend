import request from 'supertest'
import app from '../src/server.js'
import User from '../src/models/user.model.js'
import Notification from '../src/models/notification.model.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../src/constants/notification.constant.js'
import { createToken } from './fixtures/testData.js'

const API_PREFIX = '/api/v1/notifications'

describe('Notification API', () => {
  let user
  let otherUser
  let token

  beforeEach(async () => {
    await Promise.all([
      Notification.deleteMany({}),
      User.deleteMany({ email: /@notification\.test$/ }),
    ])

    user = await User.create({ name: 'Notification User', email: 'user@notification.test', password: '123456' })
    otherUser = await User.create({ name: 'Other User', email: 'other@notification.test', password: '123456' })
    token = await createToken(user._id)
  })

  const createNotification = (overrides = {}) =>
    Notification.create({
      recipient: user._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: 'Test notification',
      message: 'Test message',
      ...overrides,
    })

  it('returns only my notifications and unread count', async () => {
    await createNotification()
    await createNotification({ isRead: true, readAt: new Date() })
    await createNotification({ recipient: otherUser._id })

    const res = await request(app).get(API_PREFIX).set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.notifications).toHaveLength(2)
    expect(res.body.data.unreadCount).toBe(1)
    expect(res.body.meta.pagination.total).toBe(2)
  })

  it('does not allow reading or deleting another user notification', async () => {
    const notification = await createNotification({ recipient: otherUser._id })

    const readRes = await request(app)
      .patch(`${API_PREFIX}/${notification._id}/read`)
      .set('Authorization', `Bearer ${token}`)
    const deleteRes = await request(app)
      .delete(`${API_PREFIX}/${notification._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(readRes.statusCode).toBe(404)
    expect(deleteRes.statusCode).toBe(404)
  })

  it('returns the correct unread count', async () => {
    await createNotification()
    await createNotification()
    await createNotification({ isRead: true, readAt: new Date() })

    const res = await request(app).get(`${API_PREFIX}/unread-count`).set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.unreadCount).toBe(2)
  })

  it('marks one and all notifications as read', async () => {
    const first = await createNotification()
    await createNotification()

    const oneRes = await request(app)
      .patch(`${API_PREFIX}/${first._id}/read`)
      .set('Authorization', `Bearer ${token}`)
    expect(oneRes.statusCode).toBe(200)
    expect(oneRes.body.data.notification.isRead).toBe(true)
    expect(oneRes.body.data.notification.readAt).toBeTruthy()

    const allRes = await request(app)
      .patch(`${API_PREFIX}/read-all`)
      .set('Authorization', `Bearer ${token}`)
    expect(allRes.statusCode).toBe(200)
    expect(allRes.body.data.modifiedCount).toBe(1)
    expect(await Notification.countDocuments({ recipient: user._id, isRead: false })).toBe(0)
  })

  it('deletes my notification', async () => {
    const notification = await createNotification()

    const res = await request(app)
      .delete(`${API_PREFIX}/${notification._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(await Notification.findById(notification._id)).toBeNull()
  })

  it('filters by isRead, type, and targetType', async () => {
    await createNotification({
      type: NOTIFICATION_TYPES.CHAT_NEW_MESSAGE,
      targetType: NOTIFICATION_TARGET_TYPES.CHAT,
    })
    await createNotification({
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      targetType: NOTIFICATION_TARGET_TYPES.ORDER,
      isRead: true,
      readAt: new Date(),
    })

    const res = await request(app)
      .get(`${API_PREFIX}?isRead=false&type=${NOTIFICATION_TYPES.CHAT_NEW_MESSAGE}&targetType=${NOTIFICATION_TARGET_TYPES.CHAT}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.notifications).toHaveLength(1)
    expect(res.body.data.notifications[0].type).toBe(NOTIFICATION_TYPES.CHAT_NEW_MESSAGE)
  })

  it('paginates newest notifications first', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createNotification({ title: `Notification ${index}` })
    }

    const res = await request(app)
      .get(`${API_PREFIX}?page=2&limit=2`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.data.notifications).toHaveLength(2)
    expect(res.body.meta.pagination).toEqual(expect.objectContaining({ total: 5, page: 2, limit: 2, totalPages: 3 }))
  })

  it('requires authentication', async () => {
    const res = await request(app).get(API_PREFIX)
    expect(res.statusCode).toBe(401)
  })
})
