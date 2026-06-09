import { createServer } from 'http'
import request from 'supertest'
import { io as Client } from 'socket.io-client'
import app from '../../src/server.js'
import User from '../../src/models/user.model.js'
import Shop from '../../src/models/shop.model.js'
import Conversation from '../../src/models/conversation.model.js'
import Message from '../../src/models/message.model.js'
import Notification from '../../src/models/notification.model.js'
import PERMISSIONS from '../../src/constants/permission.constant.js'
import { ROLES } from '../../src/constants/role.constant.js'
import { initChatSocket } from '../../src/sockets/chat.socket.js'
import * as conversationService from '../../src/services/conversation/conversation.service.js'
import { createToken } from './fixtures/testData.js'

const API_PREFIX = '/api/v1'

const makeUser = (name, roles = [ROLES.MEMBER]) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '.')}@chat.test`,
    password: '123456',
    roles,
  })

const userContext = (user) => ({
  _id: user._id,
  roles: user.roles,
  isActive: user.isActive,
})

const expectRejected = async (promise) => {
  await expect(promise).rejects.toThrow()
}

const emitWithAck = (socket, event, payload) =>
  new Promise((resolve) => {
    socket.emit(event, payload, resolve)
  })

const waitForEvent = (socket, event) =>
  new Promise((resolve) => {
    socket.once(event, resolve)
  })

const connectClient = (url, token) =>
  new Promise((resolve, reject) => {
    const socket = Client(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })

    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })

const expectConnectError = (url, token) =>
  new Promise((resolve) => {
    const socket = Client(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })

    socket.once('connect', () => {
      socket.disconnect()
      resolve(false)
    })
    socket.once('connect_error', () => {
      socket.close()
      resolve(true)
    })
  })

describe('Chat conversations and realtime socket', () => {
  let memberA
  let memberB
  let sellerUser
  let shopOwner
  let shopStaffWithChatPermission
  let shopStaffWithoutChatPermission
  let admin
  let outsiderUser
  let shop
  let tokens
  let httpServer
  let ioServer
  let socketUrl
  const sockets = []

  beforeEach(async () => {
    await Promise.all([
      Message.deleteMany({}),
      Notification.deleteMany({}),
      Conversation.deleteMany({}),
      Shop.deleteMany({}),
      User.deleteMany({ email: /@chat\.test$/ }),
    ])

    memberA = await makeUser('Member A')
    memberB = await makeUser('Member B')
    sellerUser = await makeUser('Seller User', [ROLES.SELLER])
    shopOwner = await makeUser('Shop Owner', [ROLES.SHOP_OWNER])
    shopStaffWithChatPermission = await makeUser('Shop Staff With Chat', [ROLES.STAFF])
    shopStaffWithoutChatPermission = await makeUser('Shop Staff Without Chat', [ROLES.STAFF])
    admin = await makeUser('Chat Admin', [ROLES.ADMIN])
    outsiderUser = await makeUser('Outsider User')

    shop = await Shop.create({
      name: 'Chat Test Shop',
      slug: `chat-test-shop-${Date.now()}`,
      owner: shopOwner._id,
      staff: [shopStaffWithChatPermission._id, shopStaffWithoutChatPermission._id],
      staffPermissions: [
        {
          staffUser: shopStaffWithChatPermission._id,
          permissions: [PERMISSIONS.SHOP_CHAT_MANAGE],
          updatedBy: shopOwner._id,
          updatedAt: new Date(),
        },
        {
          staffUser: shopStaffWithoutChatPermission._id,
          permissions: [],
          updatedBy: shopOwner._id,
          updatedAt: new Date(),
        },
      ],
      isActive: true,
    })

    tokens = {
      memberA: await createToken(memberA._id),
      memberB: await createToken(memberB._id),
      sellerUser: await createToken(sellerUser._id, ROLES.SELLER),
      shopOwner: await createToken(shopOwner._id, ROLES.SHOP_OWNER),
      shopStaffWithChatPermission: await createToken(shopStaffWithChatPermission._id, ROLES.STAFF),
      shopStaffWithoutChatPermission: await createToken(shopStaffWithoutChatPermission._id, ROLES.STAFF),
      admin: await createToken(admin._id, ROLES.ADMIN),
      outsiderUser: await createToken(outsiderUser._id),
    }
  })

  afterEach(async () => {
    sockets.splice(0).forEach((socket) => {
      if (socket.connected) socket.disconnect()
      socket.close()
    })

    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve))
      ioServer = null
    }

    if (httpServer?.listening) {
      await new Promise((resolve) => httpServer.close(resolve))
    }
    httpServer = null
  })

  describe('REST DIRECT conversation', () => {
    it('creates member-member, member-seller, avoids duplicate, scopes list, and blocks outsiders reading messages', async () => {
      const memberDirectRes = await request(app)
        .post(`${API_PREFIX}/conversations/direct`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ targetUserId: memberB._id.toString() })

      expect(memberDirectRes.statusCode).toBe(201)
      expect(memberDirectRes.body.success).toBe(true)
      expect(memberDirectRes.body.data.conversation.type).toBe('DIRECT')

      const sellerDirectRes = await request(app)
        .post(`${API_PREFIX}/conversations/direct`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ targetUserId: sellerUser._id.toString() })

      expect(sellerDirectRes.statusCode).toBe(201)
      expect(sellerDirectRes.body.data.conversation.participants.map((item) => item._id)).toEqual(
        expect.arrayContaining([memberA._id.toString(), sellerUser._id.toString()])
      )

      const duplicateRes = await request(app)
        .post(`${API_PREFIX}/conversations/direct`)
        .set('Authorization', `Bearer ${tokens.memberB}`)
        .send({ targetUserId: memberA._id.toString() })

      expect(duplicateRes.statusCode).toBe(201)
      expect(duplicateRes.body.data.conversation._id).toBe(memberDirectRes.body.data.conversation._id)

      await conversationService.createDirectConversation(outsiderUser._id, sellerUser._id)

      const listRes = await request(app)
        .get(`${API_PREFIX}/conversations`)
        .set('Authorization', `Bearer ${tokens.memberA}`)

      expect(listRes.statusCode).toBe(200)
      const conversationIds = listRes.body.data.conversations.map((conversation) => conversation._id)
      expect(conversationIds).toEqual(expect.arrayContaining([
        memberDirectRes.body.data.conversation._id,
        sellerDirectRes.body.data.conversation._id,
      ]))
      expect(conversationIds).toHaveLength(2)

      const outsiderMessagesRes = await request(app)
        .get(`${API_PREFIX}/conversations/${memberDirectRes.body.data.conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.outsiderUser}`)

      expect(outsiderMessagesRes.statusCode).toBe(403)

      await expectRejected(
        conversationService.sendMessage(userContext(outsiderUser), {
          conversationId: memberDirectRes.body.data.conversation._id,
          content: 'No access',
        })
      )
    })
  })

  describe('REST SHOP conversation', () => {
    it('creates shop conversation once and enforces customer, owner, staff permission, outsider, and admin access', async () => {
      const createRes = await request(app)
        .post(`${API_PREFIX}/conversations/shop`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ shopId: shop._id.toString() })

      expect(createRes.statusCode).toBe(201)
      expect(createRes.body.data.conversation.type).toBe('SHOP')
      expect(createRes.body.data.conversation.customerId._id).toBe(memberA._id.toString())

      const duplicateRes = await request(app)
        .post(`${API_PREFIX}/conversations/shop`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ shopId: shop._id.toString() })

      expect(duplicateRes.statusCode).toBe(201)
      expect(duplicateRes.body.data.conversation._id).toBe(createRes.body.data.conversation._id)

      const allowedTokens = [
        tokens.memberA,
        tokens.shopOwner,
        tokens.shopStaffWithChatPermission,
        tokens.admin,
      ]

      for (const token of allowedTokens) {
        const res = await request(app)
          .get(`${API_PREFIX}/conversations/${createRes.body.data.conversation._id}/messages`)
          .set('Authorization', `Bearer ${token}`)

        expect(res.statusCode).toBe(200)
        expect(res.body.success).toBe(true)
      }

      const noPermissionStaffRes = await request(app)
        .get(`${API_PREFIX}/conversations/${createRes.body.data.conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.shopStaffWithoutChatPermission}`)

      expect(noPermissionStaffRes.statusCode).toBe(403)

      const outsiderRes = await request(app)
        .get(`${API_PREFIX}/conversations/${createRes.body.data.conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.outsiderUser}`)

      expect(outsiderRes.statusCode).toBe(403)
    })
  })

  describe('Messages', () => {
    it('sends text through REST, rejects invalid sends, updates last message fields, and marks read once', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)

      const sendRes = await request(app)
        .post(`${API_PREFIX}/conversations/${conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({
          content: 'Hello member B',
          messageType: 'TEXT',
          attachments: [],
        })

      expect(sendRes.statusCode).toBe(201)
      expect(sendRes.body.success).toBe(true)
      const message = sendRes.body.data.message
      expect(message.content).toBe('Hello member B')
      expect(message.messageType).toBe('TEXT')

      const notification = await Notification.findOne({ recipient: memberB._id, type: 'CHAT_NEW_MESSAGE' })
      expect(notification).toBeTruthy()
      expect(notification.sender.toString()).toBe(memberA._id.toString())
      expect(notification.targetType).toBe('CHAT')
      expect(notification.targetId.toString()).toBe(conversation._id.toString())
      expect(notification.actionUrl).toBe(`/chats/${conversation._id}`)
      expect(notification.data.conversationId.toString()).toBe(conversation._id.toString())
      expect(notification.data.messageId.toString()).toBe(message._id.toString())
      expect(notification.data.senderId.toString()).toBe(memberA._id.toString())

      const emptyRes = await request(app)
        .post(`${API_PREFIX}/conversations/${conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ content: '   ', messageType: 'TEXT', attachments: [] })

      expect(emptyRes.statusCode).toBe(400)

      const missingConversationRes = await request(app)
        .post(`${API_PREFIX}/conversations/6a14426a248b029a52b38b67/messages`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ content: 'Missing conversation' })

      expect(missingConversationRes.statusCode).toBe(404)

      const noAccessRes = await request(app)
        .post(`${API_PREFIX}/conversations/${conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.outsiderUser}`)
        .send({ content: 'No access' })

      expect(noAccessRes.statusCode).toBe(403)

      const updatedConversation = await Conversation.findById(conversation._id)
      expect(updatedConversation.lastMessage.content).toBe('Hello member B')
      expect(updatedConversation.lastMessage.messageId.toString()).toBe(message._id.toString())
      expect(updatedConversation.lastMessageAt).toBeInstanceOf(Date)

      await conversationService.markAsRead(userContext(memberB), conversation._id)
      await conversationService.markAsRead(userContext(memberB), conversation._id)

      const readMessage = await Message.findById(message._id)
      const memberBReadEntries = readMessage.readBy.filter((entry) => entry.userId.toString() === memberB._id.toString())
      expect(memberBReadEntries).toHaveLength(1)
    })
  })

  describe('Socket.IO', () => {
    beforeEach(async () => {
      httpServer = createServer(app)
      ioServer = initChatSocket(httpServer)
      await new Promise((resolve) => httpServer.listen(0, resolve))
      socketUrl = `http://localhost:${httpServer.address().port}`
    })

    it('connects with valid token and rejects missing or invalid token', async () => {
      const socket = await connectClient(socketUrl, tokens.memberA)
      sockets.push(socket)
      expect(socket.connected).toBe(true)

      await expect(expectConnectError(socketUrl)).resolves.toBe(true)
      await expect(expectConnectError(socketUrl, 'bad-token')).resolves.toBe(true)
    })

    it('joins conversations only when authorized', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const memberSocket = await connectClient(socketUrl, tokens.memberA)
      const outsiderSocket = await connectClient(socketUrl, tokens.outsiderUser)
      sockets.push(memberSocket, outsiderSocket)

      const joinAck = await emitWithAck(memberSocket, 'join_conversation', { conversationId: conversation._id.toString() })
      expect(joinAck.success).toBe(true)

      const errorPromise = waitForEvent(outsiderSocket, 'socket_error')
      const deniedAck = await emitWithAck(outsiderSocket, 'join_conversation', { conversationId: conversation._id.toString() })
      const error = await errorPromise

      expect(deniedAck.success).toBe(false)
      expect(error.success).toBe(false)
    })

    it('saves message and emits new_message to conversation room', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const senderSocket = await connectClient(socketUrl, tokens.memberA)
      const receiverSocket = await connectClient(socketUrl, tokens.memberB)
      sockets.push(senderSocket, receiverSocket)

      await emitWithAck(receiverSocket, 'join_conversation', { conversationId: conversation._id.toString() })

      const newMessagePromise = waitForEvent(receiverSocket, 'new_message')
      const sendAck = await emitWithAck(senderSocket, 'send_message', {
        conversationId: conversation._id.toString(),
        content: 'Realtime hello',
      })
      const emittedMessage = await newMessagePromise

      expect(sendAck.success).toBe(true)
      expect(emittedMessage.content).toBe('Realtime hello')

      const savedMessage = await Message.findById(sendAck.message._id)
      expect(savedMessage.content).toBe('Realtime hello')
    })

    it('emits new_message to room when message is sent through REST', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const receiverSocket = await connectClient(socketUrl, tokens.memberB)
      sockets.push(receiverSocket)

      await emitWithAck(receiverSocket, 'join_conversation', { conversationId: conversation._id.toString() })

      const newMessagePromise = waitForEvent(receiverSocket, 'new_message')
      const sendRes = await request(app)
        .post(`${API_PREFIX}/conversations/${conversation._id}/messages`)
        .set('Authorization', `Bearer ${tokens.memberA}`)
        .send({ content: 'REST realtime hello' })
      const emittedMessage = await newMessagePromise

      expect(sendRes.statusCode).toBe(201)
      expect(emittedMessage.content).toBe('REST realtime hello')
      expect(emittedMessage._id).toBe(sendRes.body.data.message._id)
    })

    it('emits typing events to the room', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const senderSocket = await connectClient(socketUrl, tokens.memberA)
      const receiverSocket = await connectClient(socketUrl, tokens.memberB)
      sockets.push(senderSocket, receiverSocket)

      await emitWithAck(receiverSocket, 'join_conversation', { conversationId: conversation._id.toString() })

      const typingPromise = waitForEvent(receiverSocket, 'user_typing')
      senderSocket.emit('typing_start', { conversationId: conversation._id.toString() })
      const typingPayload = await typingPromise
      expect(typingPayload.userId.toString()).toBe(memberA._id.toString())

      const stopPromise = waitForEvent(receiverSocket, 'user_stop_typing')
      senderSocket.emit('typing_stop', { conversationId: conversation._id.toString() })
      const stopPayload = await stopPromise
      expect(stopPayload.userId.toString()).toBe(memberA._id.toString())
    })

    it('marks messages read and emits messages_read', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const message = await conversationService.sendMessage(userContext(memberA), {
        conversationId: conversation._id,
        content: 'Please read',
      })
      const senderSocket = await connectClient(socketUrl, tokens.memberA)
      const readerSocket = await connectClient(socketUrl, tokens.memberB)
      sockets.push(senderSocket, readerSocket)

      await emitWithAck(senderSocket, 'join_conversation', { conversationId: conversation._id.toString() })
      await emitWithAck(readerSocket, 'join_conversation', { conversationId: conversation._id.toString() })

      const readPromise = waitForEvent(senderSocket, 'messages_read')
      const readAck = await emitWithAck(readerSocket, 'mark_as_read', { conversationId: conversation._id.toString() })
      const readPayload = await readPromise

      expect(readAck.success).toBe(true)
      expect(readPayload.conversationId.toString()).toBe(conversation._id.toString())

      const readMessage = await Message.findById(message._id)
      expect(readMessage.readBy.some((entry) => entry.userId.toString() === memberB._id.toString())).toBe(true)
    })

    it('emits socket_error when user cannot send_message', async () => {
      const conversation = await conversationService.createDirectConversation(memberA._id, memberB._id)
      const outsiderSocket = await connectClient(socketUrl, tokens.outsiderUser)
      sockets.push(outsiderSocket)

      const errorPromise = waitForEvent(outsiderSocket, 'socket_error')
      const sendAck = await emitWithAck(outsiderSocket, 'send_message', {
        conversationId: conversation._id.toString(),
        content: 'Unauthorized',
      })
      const error = await errorPromise

      expect(sendAck.success).toBe(false)
      expect(error.success).toBe(false)
    })
  })
})

