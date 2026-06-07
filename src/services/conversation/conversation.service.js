import mongoose from 'mongoose'
import * as conversationRepo from '../../repositories/conversation/conversation.repository.js'
import * as messageRepo from '../../repositories/conversation/message.repository.js'
import User from '../../models/user.model.js'
import Shop from '../../models/shop.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import { ROLES } from '../../constants/role.constant.js'
import { CONVERSATION_TYPES } from '../../models/conversation.model.js'
import { MESSAGE_TYPES } from '../../models/message.model.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)

const sortIds = (...ids) => ids.map((id) => id.toString()).sort()

const buildParticipantKey = (userA, userB) => sortIds(userA, userB).join(':')

const buildShopCustomerKey = (shopId, customerId) => `${shopId.toString()}:${customerId.toString()}`

const isAdmin = (userContext) => (userContext?.roles || []).includes(ROLES.ADMIN)

const hasShopChatPermission = (shop, userId) => {
  const ownerId = toIdString(shop.owner)
  if (ownerId === userId) return true

  const isStaff = (shop.staff || []).some((staffId) => toIdString(staffId) === userId)
  if (!isStaff) return false

  return (shop.staffPermissions || []).some((entry) => {
    const staffId = toIdString(entry.staffUser)
    return staffId === userId && Array.isArray(entry.permissions) && entry.permissions.includes(PERMISSIONS.SHOP_CHAT_MANAGE)
  })
}

const ensureUserExists = async (userId) => {
  const user = await User.findById(userId).select('_id isActive')
  if (!user || !user.isActive) {
    throw new AppError('Người dùng không tồn tại hoặc đã bị khóa', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }
  return user
}

const ensureShopExists = async (shopId) => {
  const shop = await Shop.findById(shopId).select('_id owner staff staffPermissions isActive')
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  return shop
}

export const canAccessConversation = async (userContext, conversation) => {
  if (!userContext || !conversation) return false
  if (isAdmin(userContext)) return true

  const userId = toIdString(userContext._id)
  if (!userId) return false

  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    return (conversation.participants || []).some((participant) => toIdString(participant) === userId)
  }

  if (conversation.type === CONVERSATION_TYPES.SHOP) {
    if (toIdString(conversation.customerId) === userId) return true

    const shopId = toIdString(conversation.shopId)
    if (!shopId) return false

    const shop = await ensureShopExists(shopId)
    return hasShopChatPermission(shop, userId)
  }

  return false
}

export const assertConversationAccess = async (userContext, conversationId) => {
  const conversation = await conversationRepo.findById(conversationId)
  if (!conversation || !conversation.isActive) {
    throw new AppError('Không tìm thấy cuộc trò chuyện', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const allowed = await canAccessConversation(userContext, conversation)
  if (!allowed) {
    throw new AppError('Bạn không có quyền truy cập cuộc trò chuyện này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  return conversation
}

export const createDirectConversation = async (currentUserId, targetUserId) => {
  if (currentUserId.toString() === targetUserId.toString()) {
    throw new AppError('Không thể tạo cuộc trò chuyện với chính mình', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  await Promise.all([ensureUserExists(currentUserId), ensureUserExists(targetUserId)])

  const participantIds = sortIds(currentUserId, targetUserId)
  const participantKey = buildParticipantKey(currentUserId, targetUserId)
  const existed = await conversationRepo.findDirectByParticipantKey(participantKey)
  if (existed) return existed

  const conversation = await conversationRepo.create({
    type: CONVERSATION_TYPES.DIRECT,
    participants: participantIds,
    participantKey,
  })

  return conversationRepo.findById(conversation._id)
}

export const createShopConversation = async (customerId, shopId) => {
  await Promise.all([ensureUserExists(customerId), ensureShopExists(shopId)])

  const shopCustomerKey = buildShopCustomerKey(shopId, customerId)
  const existed = await conversationRepo.findShopByCustomerKey(shopCustomerKey)
  if (existed) return existed

  const conversation = await conversationRepo.create({
    type: CONVERSATION_TYPES.SHOP,
    shopId,
    customerId,
    shopCustomerKey,
  })

  return conversationRepo.findById(conversation._id)
}

export const getConversations = async (userContext, pagination) => {
  const userId = toIdString(userContext._id)
  const filter = { isActive: true }

  if (!isAdmin(userContext)) {
    const manageableShopIds = await Shop.find({
      isActive: true,
      $or: [
        { owner: userId },
        {
          staff: userId,
          staffPermissions: {
            $elemMatch: {
              staffUser: userId,
              permissions: PERMISSIONS.SHOP_CHAT_MANAGE,
            },
          },
        },
      ],
    }).distinct('_id')

    filter.$or = [
      { type: CONVERSATION_TYPES.DIRECT, participants: userId },
      { type: CONVERSATION_TYPES.SHOP, customerId: userId },
      { type: CONVERSATION_TYPES.SHOP, shopId: { $in: manageableShopIds } },
    ]
  }

  const [conversations, total] = await Promise.all([
    conversationRepo.findMany({ filter, ...pagination, sortBy: pagination.sortBy || 'updatedAt' }),
    conversationRepo.countMany(filter),
  ])

  return {
    conversations,
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  }
}

export const getMessages = async (userContext, conversationId, pagination) => {
  await assertConversationAccess(userContext, conversationId)

  const filter = { conversationId: new mongoose.Types.ObjectId(conversationId) }
  const [messages, total] = await Promise.all([
    messageRepo.findMany({ filter, ...pagination, sortBy: pagination.sortBy || 'createdAt' }),
    messageRepo.countMany(filter),
  ])

  return {
    messages: messages.reverse(),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  }
}

export const sendMessage = async (userContext, { conversationId, content = '', messageType = MESSAGE_TYPES.TEXT, attachments = [] }) => {
  const conversation = await assertConversationAccess(userContext, conversationId)

  const hasContent = typeof content === 'string' && content.trim().length > 0
  if (!hasContent && !attachments.length) {
    throw new AppError('Tin nhắn không được để trống', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const now = new Date()
  const message = await messageRepo.create({
    conversationId,
    senderId: userContext._id,
    content: hasContent ? content.trim() : '',
    messageType,
    attachments,
    readBy: [
      {
        userId: userContext._id,
        readAt: now,
      },
    ],
  })

  await conversationRepo.updateById(conversationId, {
    lastMessage: {
      messageId: message._id,
      senderId: userContext._id,
      content: message.content,
      messageType: message.messageType,
      sentAt: message.createdAt || now,
    },
    lastMessageAt: message.createdAt || now,
  })

  const [populatedMessage] = await messageRepo.findMany({
    filter: { _id: message._id },
    skip: 0,
    limit: 1,
    sortBy: 'createdAt',
    sortOrder: 1,
  })

  const senderId = toIdString(userContext._id)
  const recipientIds = conversation.type === CONVERSATION_TYPES.DIRECT
    ? (conversation.participants || []).map(toIdString).filter((id) => id && id !== senderId)
    : toIdString(conversation.customerId) === senderId
      ? [toIdString(conversation.shopId?.owner), ...(conversation.shopId?.staff || []).map(toIdString)]
      : [toIdString(conversation.customerId)]

  const notificationType = messageType === MESSAGE_TYPES.IMAGE
    ? NOTIFICATION_TYPES.CHAT_NEW_IMAGE
    : messageType === MESSAGE_TYPES.FILE
      ? NOTIFICATION_TYPES.CHAT_NEW_FILE
      : NOTIFICATION_TYPES.CHAT_NEW_MESSAGE

  await notifySafely([...new Set(recipientIds.filter((id) => id && id !== senderId))].map((recipient) => ({
    recipient,
    sender: userContext._id,
    type: notificationType,
    title: 'Tin nhắn mới',
    message: hasContent ? content.trim().slice(0, 1000) : 'Bạn có tin nhắn mới',
    targetType: NOTIFICATION_TARGET_TYPES.CHAT,
    targetId: conversationId,
    actionUrl: `/chats/${conversationId}`,
    data: {
      conversationId,
      messageId: message._id,
      senderId: userContext._id,
    },
  })))

  return populatedMessage || message
}

export const markAsRead = async (userContext, conversationId) => {
  await assertConversationAccess(userContext, conversationId)
  const result = await messageRepo.markConversationAsRead(conversationId, userContext._id)

  return {
    conversationId,
    userId: userContext._id,
    modifiedCount: result.modifiedCount || 0,
    readAt: new Date(),
  }
}
