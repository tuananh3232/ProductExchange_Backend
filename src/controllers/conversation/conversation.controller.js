import * as conversationService from '../../services/conversation/conversation.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { emitNewMessageToConversation } from '../../sockets/chat.socket.js'
import MESSAGES from '../../constants/message.constant.js'

export const createDirectConversation = asyncHandler(async (req, res) => {
  const conversation = await conversationService.createDirectConversation(req.user._id, req.body.targetUserId)
  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.CREATED,
    data: { conversation },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const createShopConversation = asyncHandler(async (req, res) => {
  const conversation = await conversationService.createShopConversation(req.user._id, req.body.shopId)
  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.SHOP_CREATED,
    data: { conversation },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const getConversations = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { conversations, meta } = await conversationService.getConversations(req.user, pagination, req.query)
  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.FETCHED,
    data: { conversations },
    meta,
  })
})

export const getMessages = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams({ ...req.query, limit: req.query.limit || 20 })
  const { messages, meta } = await conversationService.getMessages(req.user, req.params.id, pagination)
  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.MESSAGES_FETCHED,
    data: { messages },
    meta,
  })
})

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await conversationService.sendMessage(req.user, {
    conversationId: req.params.id,
    content: req.body.content,
    messageType: req.body.messageType,
    attachments: req.body.attachments,
    actingAs: req.body.actingAs,
    shopId: req.body.shopId,
  })

  emitNewMessageToConversation(req.params.id, message)

  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.MESSAGE_SENT,
    data: { message },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const markAsRead = asyncHandler(async (req, res) => {
  const result = await conversationService.markAsRead(req.user, req.params.id)
  sendSuccess(res, {
    message: MESSAGES.CONVERSATION.MARKED_AS_READ,
    data: result,
  })
})
