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
import { MESSAGE_ACTOR_TYPES, MESSAGE_TYPES } from '../../models/message.model.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)

const sortIds = (...ids) => ids.map((id) => id.toString()).sort()

const buildParticipantKey = (userA, userB) => sortIds(userA, userB).join(':')

const buildShopCustomerKey = (shopId, customerId) => `${shopId.toString()}:${customerId.toString()}`

const isAdmin = (userContext) => (userContext?.roles || []).includes(ROLES.ADMIN)

const hasShopChatPermission = (shop, userId, permissionKey = PERMISSIONS.SHOP_CHAT_READ) => {
  const ownerId = toIdString(shop.owner)
  if (ownerId === userId) return true

  const isStaff = (shop.staff || []).some((staffId) => toIdString(staffId) === userId)
  if (!isStaff) return false

  return (shop.staffPermissions || []).some((entry) => {
    const staffId = toIdString(entry.staffUser)
    return staffId === userId && Array.isArray(entry.permissions) && entry.permissions.includes(permissionKey)
  })
}

const toPublicUser = (user) => {
  if (!user) return null
  return {
    id: toIdString(user),
    name: user.name,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    avatar: user.avatar,
  }
}

const toPublicShop = (shop) => {
  if (!shop) return null
  return {
    id: toIdString(shop),
    name: shop.name,
    logoUrl: shop.logoUrl,
    avatarUrl: shop.avatarUrl,
  }
}

const normalizeLastMessage = (lastMessage) => {
  if (!lastMessage) return null
  return {
    ...lastMessage,
    messageId: toIdString(lastMessage.messageId),
    senderId: toIdString(lastMessage.senderId),
    senderType: lastMessage.senderType || MESSAGE_ACTOR_TYPES.USER,
    senderUserId: toIdString(lastMessage.senderUserId || lastMessage.senderId),
    senderShopId: toIdString(lastMessage.senderShopId),
  }
}

const normalizeConversation = (conversation, context = {}, unreadCount = 0) => ({
  ...conversation,
  id: toIdString(conversation),
  _id: conversation._id,
  shopId: conversation.shopId,
  customerId: conversation.customerId,
  participants: conversation.participants,
  lastMessage: normalizeLastMessage(conversation.lastMessage),
  context,
  unreadCount,
})

const normalizeMessage = (message) => {
  const senderType = message.senderType || MESSAGE_ACTOR_TYPES.USER
  return {
    ...message,
    id: toIdString(message),
    conversationId: toIdString(message.conversationId),
    senderId: toIdString(message.senderId),
    senderType,
    senderUserId: toIdString(message.senderUserId || message.senderId),
    senderShopId: toIdString(message.senderShopId),
    sender: toPublicUser(message.senderUserId || message.senderId),
    shopActor: senderType === MESSAGE_ACTOR_TYPES.SHOP ? toPublicShop(message.senderShopId) : null,
  }
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

const assertShopChatAccess = async (userContext, shopId, permissionKey = PERMISSIONS.SHOP_CHAT_READ) => {
  if (!shopId) {
    throw new AppError('shopId is required', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const shop = await ensureShopExists(shopId)
  if (isAdmin(userContext)) return shop

  const userId = toIdString(userContext?._id)
  if (!hasShopChatPermission(shop, userId, permissionKey)) {
    throw new AppError('You do not have permission to chat as this shop', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
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
    return hasShopChatPermission(shop, userId, PERMISSIONS.SHOP_CHAT_READ)
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

export const assertConversationActorAccess = async (
  userContext,
  conversation,
  { actingAs = MESSAGE_ACTOR_TYPES.USER, shopId = null } = {},
) => {
  const userId = toIdString(userContext?._id)
  const actor = actingAs || MESSAGE_ACTOR_TYPES.USER

  if (actor === MESSAGE_ACTOR_TYPES.SHOP) {
    if (conversation.type !== CONVERSATION_TYPES.SHOP) {
      throw new AppError('Shop actor is only allowed in shop conversations', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }

    const conversationShopId = toIdString(conversation.shopId)
    if (!shopId || conversationShopId !== toIdString(shopId)) {
      throw new AppError('shopId does not match this conversation', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
    }

    await assertShopChatAccess(userContext, conversationShopId, PERMISSIONS.SHOP_CHAT_SEND)
    return {
      senderType: MESSAGE_ACTOR_TYPES.SHOP,
      senderUserId: userContext._id,
      senderShopId: conversationShopId,
    }
  }

  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    const isParticipant = (conversation.participants || []).some((participant) => toIdString(participant) === userId)
    if (!isParticipant && !isAdmin(userContext)) {
      throw new AppError('You cannot reply to this direct conversation', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
    }
  }

  if (conversation.type === CONVERSATION_TYPES.SHOP && toIdString(conversation.customerId) !== userId && !isAdmin(userContext)) {
    throw new AppError('Use actingAs=SHOP to reply from the shop workspace', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  return {
    senderType: MESSAGE_ACTOR_TYPES.USER,
    senderUserId: userContext._id,
    senderShopId: null,
  }
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

export const getConversations = async (userContext, pagination, query = {}) => {
  const userId = toIdString(userContext._id)
  const filter = { isActive: true }
  const scope = query.scope || 'main'

  if (scope === 'workspace') {
    await assertShopChatAccess(userContext, query.shopId, PERMISSIONS.SHOP_CHAT_READ)
    filter.type = CONVERSATION_TYPES.SHOP
    filter.shopId = query.shopId
  } else {
    filter.$or = [
      { type: CONVERSATION_TYPES.DIRECT, participants: userId },
      { type: CONVERSATION_TYPES.SHOP, customerId: userId },
    ]
  }

  const [conversations, total] = await Promise.all([
    conversationRepo.findMany({ filter, ...pagination, sortBy: pagination.sortBy || 'updatedAt' }),
    conversationRepo.countMany(filter),
  ])

  const unreadCounts = await Promise.all(conversations.map((conversation) => messageRepo.countMany({
    conversationId: conversation._id,
    senderId: { $ne: userContext._id },
    'readBy.userId': { $ne: userContext._id },
  })))

  return {
    conversations: conversations.map((conversation, index) => normalizeConversation(conversation, {
      scope,
      actingAs: scope === 'workspace' ? MESSAGE_ACTOR_TYPES.SHOP : MESSAGE_ACTOR_TYPES.USER,
      shopId: scope === 'workspace' ? toIdString(query.shopId) : null,
    }, unreadCounts[index])),
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
    messages: messages.reverse().map(normalizeMessage),
    meta: buildPaginationMeta(total, pagination.page, pagination.limit),
  }
}

export const sendMessage = async (
  userContext,
  {
    conversationId,
    content = '',
    messageType = MESSAGE_TYPES.TEXT,
    attachments = [],
    actingAs = MESSAGE_ACTOR_TYPES.USER,
    shopId = null,
  },
) => {
  const conversation = await assertConversationAccess(userContext, conversationId)
  const actor = await assertConversationActorAccess(userContext, conversation, { actingAs, shopId })

  const hasContent = typeof content === 'string' && content.trim().length > 0
  if (!hasContent && !attachments.length) {
    throw new AppError('Tin nhắn không được để trống', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  const now = new Date()
  const senderShopId = actor.senderShopId ? new mongoose.Types.ObjectId(actor.senderShopId) : null
  const message = await messageRepo.create({
    conversationId,
    senderId: userContext._id,
    senderType: actor.senderType,
    senderUserId: actor.senderUserId,
    senderShopId,
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
      senderType: actor.senderType,
      senderUserId: actor.senderUserId,
      senderShopId,
      content: message.content,
      messageType: message.messageType,
      sentAt: message.createdAt || now,
      createdAt: message.createdAt || now,
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
  let recipientIds = []
  if (conversation.type === CONVERSATION_TYPES.DIRECT) {
    recipientIds = (conversation.participants || []).map(toIdString).filter((id) => id && id !== senderId)
  } else if (actor.senderType === MESSAGE_ACTOR_TYPES.SHOP) {
    recipientIds = [toIdString(conversation.customerId)]
  } else {
    recipientIds = [toIdString(conversation.shopId?.owner), ...(conversation.shopId?.staff || []).map(toIdString)]
  }

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
      senderType: actor.senderType,
      senderUserId: actor.senderUserId,
      senderShopId: actor.senderShopId,
    },
  })))

  return normalizeMessage(populatedMessage || message)
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
