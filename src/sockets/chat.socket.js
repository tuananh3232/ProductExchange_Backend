import { Server } from 'socket.io'
import { verifyAccessToken } from '../providers/jwt.provider.js'
import User from '../models/user.model.js'
import { MESSAGE_ACTOR_TYPES } from '../models/message.model.js'
import * as conversationService from '../services/conversation/conversation.service.js'
import { corsOptions } from '../configs/cors.config.js'
import ERRORS from '../constants/error.constant.js'
import { conversationRoom, getSocketServer, setSocketServer, userRoom } from './socket-hub.js'

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token
  if (authToken) return authToken

  const header = socket.handshake.headers?.authorization
  if (header?.startsWith('Bearer ')) return header.split(' ')[1]

  return null
}

const toSocketUser = (user) => ({
  _id: user._id,
  roles: Array.isArray(user.roles) ? user.roles : [],
  isActive: user.isActive,
})

const createSocketError = (message, error) => {
  const socketError = new Error(message)
  socketError.data = { error }
  return socketError
}

const getSocketErrorPayload = (error) => ({
  success: false,
  message: error?.message || 'Đã xảy ra lỗi, vui lòng thử lại sau',
  error: error?.errorCode || error?.data?.error || error?.message || ERRORS.CONVERSATION.SOCKET_ERROR,
})

const emitSocketError = (socket, error) => {
  socket.emit('socket_error', getSocketErrorPayload(error))
}

export const emitNewMessageToConversation = (conversationId, message) => {
  const io = getSocketServer()
  if (!io) return
  io.to(conversationRoom(conversationId)).emit('new_message', message)
}

export const initChatSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
      methods: corsOptions.methods,
      allowedHeaders: corsOptions.allowedHeaders,
    },
  })
  setSocketServer(io)

  io.use(async (socket, next) => {
    try {
      const token = getTokenFromSocket(socket)
      if (!token) {
        return next(createSocketError('Vui lòng đăng nhập để tiếp tục', ERRORS.CONVERSATION.AUTHENTICATION_REQUIRED))
      }

      const decoded = verifyAccessToken(token)
      const user = await User.findById(decoded.userId).select('_id roles isActive')
      if (!user || !user.isActive) {
        return next(createSocketError('Xác thực không thành công', ERRORS.CONVERSATION.AUTHENTICATION_FAILED))
      }

      socket.user = toSocketUser(user)
      next()
    } catch (error) {
      next(error)
    }
  })

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.user._id))

    socket.on('join_conversation', async ({ conversationId } = {}, callback) => {
      try {
        await conversationService.assertConversationAccess(socket.user, conversationId)
        socket.join(conversationRoom(conversationId))
        callback?.({ success: true, conversationId })
      } catch (error) {
        const payload = getSocketErrorPayload(error)
        emitSocketError(socket, error)
        callback?.(payload)
      }
    })

    socket.on('send_message', async (payload = {}, callback) => {
      try {
        const message = await conversationService.sendMessage(socket.user, payload)
        emitNewMessageToConversation(payload.conversationId, message)
        callback?.({ success: true, message })
      } catch (error) {
        const payload = getSocketErrorPayload(error)
        emitSocketError(socket, error)
        callback?.(payload)
      }
    })

    socket.on('typing_start', async ({ conversationId, actingAs = MESSAGE_ACTOR_TYPES.USER, shopId = null } = {}) => {
      try {
        const conversation = await conversationService.assertConversationAccess(socket.user, conversationId)
        const actor = await conversationService.assertConversationActorAccess(socket.user, conversation, { actingAs, shopId })
        socket.to(conversationRoom(conversationId)).emit('typing_start', {
          conversationId,
          userId: socket.user._id,
          actingAs: actor.senderType,
          shopId: actor.senderShopId,
        })
        socket.to(conversationRoom(conversationId)).emit('user_typing', {
          conversationId,
          userId: socket.user._id,
          actingAs: actor.senderType,
          shopId: actor.senderShopId,
        })
      } catch {
        // Ignore unauthorized typing hints.
      }
    })

    socket.on('typing_stop', async ({ conversationId, actingAs = MESSAGE_ACTOR_TYPES.USER, shopId = null } = {}) => {
      try {
        const conversation = await conversationService.assertConversationAccess(socket.user, conversationId)
        const actor = await conversationService.assertConversationActorAccess(socket.user, conversation, { actingAs, shopId })
        socket.to(conversationRoom(conversationId)).emit('typing_stop', {
          conversationId,
          userId: socket.user._id,
          actingAs: actor.senderType,
          shopId: actor.senderShopId,
        })
        socket.to(conversationRoom(conversationId)).emit('user_stop_typing', {
          conversationId,
          userId: socket.user._id,
          actingAs: actor.senderType,
          shopId: actor.senderShopId,
        })
      } catch {
        // Ignore unauthorized typing hints.
      }
    })

    socket.on('mark_as_read', async ({ conversationId } = {}, callback) => {
      try {
        const result = await conversationService.markAsRead(socket.user, conversationId)
        io.to(conversationRoom(conversationId)).emit('conversation_read', result)
        io.to(conversationRoom(conversationId)).emit('messages_read', result)
        callback?.({ success: true, result })
      } catch (error) {
        const payload = getSocketErrorPayload(error)
        emitSocketError(socket, error)
        callback?.(payload)
      }
    })
  })

  return io
}
