import { Router } from 'express'
import * as notificationController from '../../controllers/notification/notification.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'

const router = Router()

router.use(authenticate)
router.get('/', notificationController.getMyNotifications)
router.get('/unread-count', notificationController.getUnreadCount)
router.patch('/read-all', notificationController.markAllNotificationsAsRead)
router.patch('/:id/read', validateObjectId('id'), notificationController.markNotificationAsRead)
router.delete('/:id', validateObjectId('id'), notificationController.deleteNotification)

export default router

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: API quản lý thông báo của người dùng đã đăng nhập
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         _id: { type: string }
 *         recipient: { type: string }
 *         sender: { type: string, nullable: true }
 *         type: { type: string, example: CHAT_NEW_MESSAGE }
 *         title: { type: string }
 *         message: { type: string }
 *         data: { type: object }
 *         targetType: { type: string, enum: [USER, SHOP, PRODUCT, ORDER, PAYMENT, CHAT, REVIEW, REPORT, VOUCHER, SYSTEM] }
 *         targetId: { type: string, nullable: true }
 *         actionUrl: { type: string, nullable: true }
 *         priority: { type: string, enum: [LOW, NORMAL, HIGH, URGENT] }
 *         channels:
 *           type: array
 *           items: { type: string, enum: [IN_APP, EMAIL, PUSH, SOCKET] }
 *         isRead: { type: boolean }
 *         readAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 * /notifications:
 *   get:
 *     summary: Lấy danh sách thông báo của tôi
 *     tags: [Notifications]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *       - { in: query, name: isRead, schema: { type: boolean } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: targetType, schema: { type: string } }
 *     responses:
 *       200: { description: Danh sách thông báo kèm phân trang và số lượng chưa đọc }
 * /notifications/unread-count:
 *   get:
 *     summary: Lấy số lượng thông báo chưa đọc của tôi
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Số lượng thông báo chưa đọc }
 * /notifications/{id}/read:
 *   patch:
 *     summary: Đánh dấu một thông báo của tôi là đã đọc
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đánh dấu thông báo là đã đọc thành công }
 *       404: { description: Thông báo không thuộc người dùng hiện tại hoặc không tồn tại }
 * /notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo của tôi là đã đọc
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Đánh dấu tất cả thông báo là đã đọc thành công }
 * /notifications/{id}:
 *   delete:
 *     summary: Xóa một thông báo của tôi
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Xóa thông báo thành công }
 *       404: { description: Thông báo không thuộc người dùng hiện tại hoặc không tồn tại }
 */
