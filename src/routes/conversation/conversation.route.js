import { Router } from 'express'
import * as conversationController from '../../controllers/conversation/conversation.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import {
  createDirectConversationSchema,
  createShopConversationSchema,
  sendConversationMessageSchema,
} from '../../validations/conversation/conversation.validation.js'

const router = Router()

router.use(authenticate)

router.post('/direct', validate(createDirectConversationSchema), conversationController.createDirectConversation)
router.post('/shop', validate(createShopConversationSchema), conversationController.createShopConversation)
router.get('/', conversationController.getConversations)
router.get('/:id/messages', validateObjectId('id'), conversationController.getMessages)
router.post(
  '/:id/messages',
  validateObjectId('id'),
  validate(sendConversationMessageSchema),
  conversationController.sendMessage
)
router.patch('/:id/read', validateObjectId('id'), conversationController.markAsRead)

export default router

/**
 * @swagger
 * tags:
 *   - name: Chat - Conversations
 *     description: API quản lý chat
 *
 * components:
 *   schemas:
 *     ChatAttachment:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *           example: https://res.cloudinary.com/demo/image/upload/sample.jpg
 *         publicId:
 *           type: string
 *           example: chat/sample
 *         name:
 *           type: string
 *           example: sample.jpg
 *         mimeType:
 *           type: string
 *           example: image/jpeg
 *         size:
 *           type: number
 *           example: 204800
 *     ChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         conversationId:
 *           type: string
 *         senderId:
 *           oneOf:
 *             - type: string
 *             - $ref: '#/components/schemas/User'
 *         content:
 *           type: string
 *           example: Xin chào
 *         messageType:
 *           type: string
 *           enum: [TEXT, IMAGE, FILE]
 *           example: TEXT
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatAttachment'
 *         readBy:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 oneOf:
 *                   - type: string
 *                   - $ref: '#/components/schemas/User'
 *               readAt:
 *                 type: string
 *                 format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     Conversation:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum: [DIRECT, SHOP]
 *           example: DIRECT
 *         participants:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/User'
 *           description: Chỉ dùng cho cuộc trò chuyện DIRECT
 *         shopId:
 *           oneOf:
 *             - type: string
 *             - $ref: '#/components/schemas/Shop'
 *           nullable: true
 *           description: Chỉ dùng cho cuộc trò chuyện SHOP
 *         customerId:
 *           oneOf:
 *             - type: string
 *             - $ref: '#/components/schemas/User'
 *           nullable: true
 *           description: Khách hàng hoặc thành viên của cuộc trò chuyện SHOP
 *         lastMessage:
 *           type: object
 *           nullable: true
 *           properties:
 *             messageId:
 *               type: string
 *             senderId:
 *               oneOf:
 *                 - type: string
 *                 - $ref: '#/components/schemas/User'
 *             content:
 *               type: string
 *             messageType:
 *               type: string
 *               enum: [TEXT, IMAGE, FILE]
 *             sentAt:
 *               type: string
 *               format: date-time
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 * /conversations/direct:
 *   post:
 *     summary: Cuộc trò chuyện trực tiếp giữa 2 người dùng
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 example: 665f1f77bcf86cd799439011
 *     responses:
 *       201:
 *         description: Tạo hoặc lấy cuộc trò chuyện thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         conversation:
 *                           $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: Chưa đăng nhập hoặc token không hợp lệ
 *       403:
 *         description: Không có quyền
 *
 * /conversations/shop:
 *   post:
 *     summary: Cuộc trò chuyện giữa khách hàng và shop
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId]
 *             properties:
 *               shopId:
 *                 type: string
 *                 example: 665f1f77bcf86cd799439022
 *     responses:
 *       201:
 *         description: Tạo hoặc lấy cuộc trò chuyện với shop thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         conversation:
 *                           $ref: '#/components/schemas/Conversation'
 *
 * /conversations:
 *   get:
 *     summary: Lấy danh sách cuộc trò chuyện của người dùng
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: updatedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lấy danh sách cuộc trò chuyện thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         conversations:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Conversation'
 *
 * /conversations/{id}/messages:
 *   get:
 *     summary: Lấy danh sách tin nhắn trong cuộc trò chuyện
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lấy danh sách tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         messages:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ChatMessage'
 *       403:
 *         description: Không có quyền xem cuộc trò chuyện
 *       404:
 *         description: Cuộc trò chuyện không tồn tại
 *   post:
 *     summary: Gửi tin nhắn vào cuộc trò chuyện
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: Xin chào sốp, sốp có bán người yêu cho mình không?
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, IMAGE, FILE]
 *                 default: TEXT
 *                 example: TEXT
 *               attachments:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ChatAttachment'
 *                 default: []
 *           example:
 *             content: Xin chào sốp, sốp có bán người yêu cho mình không?
 *             messageType: TEXT
 *             attachments: []
 *     responses:
 *       201:
 *         description: Gửi tin nhắn thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         message:
 *                           $ref: '#/components/schemas/ChatMessage'
 *             example:
 *               success: true
 *               message: Gửi tin nhắn thành công
 *               data:
 *                 message:
 *                   _id: messageId
 *                   conversationId: conversationId
 *                   senderId: userId
 *                   content: Xin chào sốp, sốp có bán người yêu cho mình không?
 *                   messageType: TEXT
 *                   attachments: []
 *                   readBy: []
 *                   createdAt: 2026-01-01T00:00:00.000Z
 *       400:
 *         description: Nội dung rỗng hoặc dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền gửi tin nhắn vào cuộc trò chuyện
 *       404:
 *         description: Cuộc trò chuyện không tồn tại
 *
 * /conversations/{id}/read:
 *   patch:
 *     summary: Đánh dấu đã đọc các tin nhắn trong cuộc trò chuyện
 *     tags: [Chat - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đánh dấu đã đọc thành công
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         conversationId:
 *                           type: string
 *                         userId:
 *                           type: string
 *                         modifiedCount:
 *                           type: integer
 *                         readAt:
 *                           type: string
 *                           format: date-time
 *       403:
 *         description: Không có quyền thao tác với cuộc trò chuyện
 *       404:
 *         description: Cuộc trò chuyện không tồn tại
 */
