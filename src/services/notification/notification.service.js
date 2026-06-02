import mongoose from 'mongoose'
import Notification from '../../models/notification.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'

export const createNotification = (payload) => Notification.create(payload)

export const createManyNotifications = (list) => {
  if (!Array.isArray(list) || !list.length) return []
  return Notification.insertMany(list)
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

  return { notifications, pagination: buildPaginationMeta(total, page, limit).pagination, unreadCount }
}

const getOwnedNotificationOrThrow = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, recipient: userId })
  if (!notification) {
    throw new AppError('Khong tim thay thong bao', HTTP_STATUS.NOT_FOUND, ERRORS.NOTIFICATION.NOT_FOUND)
  }
  return notification
}

export const markNotificationAsRead = async (userId, notificationId) => {
  const notification = await getOwnedNotificationOrThrow(userId, notificationId)
  if (!notification.isRead) {
    notification.isRead = true
    notification.readAt = new Date()
    await notification.save()
  }
  return notification
}

export const markAllNotificationsAsRead = async (userId) => {
  const readAt = new Date()
  const result = await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true, readAt })
  return { modifiedCount: result.modifiedCount || 0, readAt }
}

export const deleteNotification = async (userId, notificationId) => {
  const notification = await getOwnedNotificationOrThrow(userId, notificationId)
  await notification.deleteOne()
}

