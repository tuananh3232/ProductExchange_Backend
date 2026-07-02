import Notification from '../../models/notification.model.js'
import Shop from '../../models/shop.model.js'
import User from '../../models/user.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { ROLE_ENUM } from '../../constants/role.constant.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'
import { createManyNotifications } from '../notification/notification.service.js'
import { writeAuditLog } from '../audit/audit-log.service.js'

const MAX_NOTIFICATION_RECIPIENTS = 500

const toIdString = (value) => (value?._id ? value._id.toString() : value ? value.toString() : null)

const toPagination = (query = {}) => ({
  page: Math.max(1, parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10)),
  sortOrder: query.sortOrder === 'asc' ? 1 : -1,
})

export const getAdminNotifications = async (query = {}) => {
  const { page, limit, sortOrder } = toPagination(query)
  const filter = { createdBy: { $ne: null } }
  const skip = (page - 1) * limit
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
  ])

  return {
    notifications: notifications.map((notification) => {
      const value = notification.toObject()
      return {
        _id: value._id.toString(),
        title: value.title,
        message: value.message,
        type: value.type,
        targetType: value.targetType,
        targetUrl: value.targetUrl,
        recipientCount: value.recipientCount || 0,
        createdBy: value.createdBy
          ? { _id: value.createdBy._id.toString(), name: value.createdBy.name, email: value.createdBy.email }
          : null,
        createdAt: value.createdAt,
      }
    }),
    meta: {
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    },
  }
}

const resolveNotificationRecipients = async ({ targetType, targetIds = [] }) => {
  if (targetType === 'all') {
    return User.find({ isActive: true }).select('_id').limit(MAX_NOTIFICATION_RECIPIENTS)
  }

  if (targetType === 'users') {
    return User.find({ _id: { $in: targetIds }, isActive: true }).select('_id').limit(MAX_NOTIFICATION_RECIPIENTS)
  }

  if (targetType === 'roles') {
    const roles = targetIds.filter((role) => ROLE_ENUM.includes(role))
    return User.find({ roles: { $in: roles }, isActive: true }).select('_id').limit(MAX_NOTIFICATION_RECIPIENTS)
  }

  if (targetType === 'shops') {
    const shops = await Shop.find({ _id: { $in: targetIds }, isActive: true }).select('owner').limit(MAX_NOTIFICATION_RECIPIENTS)
    const ownerIds = [...new Set(shops.map((shop) => toIdString(shop.owner)).filter(Boolean))]
    return User.find({ _id: { $in: ownerIds }, isActive: true }).select('_id').limit(MAX_NOTIFICATION_RECIPIENTS)
  }

  throw new AppError('targetType không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
}

export const sendAdminNotification = async ({ title, message, targetType, targetIds = [], targetUrl = '/notifications' }, actor) => {
  const recipients = await resolveNotificationRecipients({ targetType, targetIds })
  if (!recipients.length) {
    throw new AppError('Không tìm thấy người nhận thông báo', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const recipientCount = recipients.length
  const notifications = await createManyNotifications(
    recipients.map((recipient) => ({
      recipient: recipient._id,
      sender: actor._id,
      createdBy: actor._id,
      recipientCount,
      type: NOTIFICATION_TYPES.SYSTEM,
      title,
      message,
      targetType: NOTIFICATION_TARGET_TYPES.SYSTEM,
      targetUrl,
      metadata: {
        adminNotification: true,
        targetType,
        targetIds,
      },
      data: {
        adminNotification: true,
        targetType,
      },
    }))
  )

  await writeAuditLog({
    adminId: actor._id,
    action: 'ADMIN_NOTIFICATION_SENT',
    targetType: 'notification',
    targetId: notifications[0]?._id || actor._id,
    newStatus: 'sent',
    metadata: { recipientCount, targetType },
  })

  return { recipientCount, notifications: notifications.map((notification) => notification._id.toString()) }
}
