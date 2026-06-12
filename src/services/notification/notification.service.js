import mongoose from 'mongoose'
import Notification from '../../models/notification.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { emitToUser } from '../../sockets/socket-hub.js'
import { buildNotificationTarget } from './notification-target.helper.js'

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)

const serializeNotification = (notification) => {
  const plain = typeof notification.toObject === 'function' ? notification.toObject() : { ...notification }

  return {
    ...plain,
    _id: toIdString(plain._id),
    recipient: toIdString(plain.recipient),
    sender: toIdString(plain.sender),
    targetId: toIdString(plain.targetId),
    targetUrl: plain.targetUrl || null,
    metadata: plain.metadata || {},
  }
}

const normalizeNotificationPayload = (payload = {}) => {
  const target = buildNotificationTarget(payload)
  return {
    ...payload,
    data: payload.data || target.metadata || {},
    targetType: target.targetType,
    targetId: target.targetId,
    targetUrl: target.targetUrl,
    metadata: target.metadata || {},
    actionUrl: target.targetUrl,
  }
}

const emitCreatedNotification = async (notification) => {
  const recipientId = toIdString(notification.recipient)
  if (!recipientId) {
    return
  }

  const unreadCount = await getUnreadCount(recipientId)
  emitToUser(recipientId, 'notification_created', {
    notification: serializeNotification(notification),
    unreadCount,
  })
}

export const createNotification = async (payload) => {
  const notification = await Notification.create(normalizeNotificationPayload(payload))
  await emitCreatedNotification(notification)
  return notification
}

export const createManyNotifications = async (list) => {
  if (!Array.isArray(list) || !list.length) return []

  const notifications = await Notification.insertMany(list.map(normalizeNotificationPayload))
  await Promise.all(notifications.map((notification) => emitCreatedNotification(notification)))
  return notifications
}

export const notifySafely = async (payloadOrList) => {
  if (mongoose.connection.readyState !== 1) return null

  try {
    return Array.isArray(payloadOrList)
      ? await createManyNotifications(payloadOrList)
      : await createNotification(payloadOrList)
  } catch (error) {
    console.warn('Failed to create notification:', error.message)
    return null
  }
}

export const getUnreadCount = (userId) => Notification.countDocuments({ recipient: userId, isRead: false })

export const getMyNotifications = async (userId, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10))
  const filter = { recipient: userId }

  if (query.isRead === 'true' || query.isRead === true) filter.isRead = true
  if (query.isRead === 'false' || query.isRead === false) filter.isRead = false
  if (query.type) filter.type = query.type
  if (query.targetType) filter.targetType = query.targetType

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    getUnreadCount(userId),
  ])

  return {
    notifications: notifications.map(serializeNotification),
    pagination: buildPaginationMeta(total, page, limit).pagination,
    unreadCount,
  }
}

const getOwnedNotificationOrThrow = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId })
  if (!notification) {
    throw new AppError('Không tìm thấy thông báo', HTTP_STATUS.NOT_FOUND, ERRORS.NOTIFICATION.NOT_FOUND)
  }
  return notification
}

export const markNotificationAsRead = async (userId, notificationId) => {
  await getOwnedNotificationOrThrow(userId, notificationId)
  const updatedNotification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() },
    { returnDocument: 'after' }
  )
  const notification = updatedNotification || (await getOwnedNotificationOrThrow(userId, notificationId))
  return serializeNotification(notification)
}

export const markAllNotificationsAsRead = async (userId) => {
  const readAt = new Date()
  const result = await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true, readAt })
  return { modifiedCount: result.modifiedCount || 0, readAt }
}

export const deleteNotification = async (userId, notificationId) => {
  await getOwnedNotificationOrThrow(userId, notificationId)
  await Notification.deleteOne({ _id: notificationId, recipient: userId })
}

