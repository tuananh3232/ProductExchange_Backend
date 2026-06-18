import { Router } from 'express'
import * as notificationController from '../../controllers/notification/notification.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

router.use(authenticate)
router.get('/', requirePermissions(PERMISSIONS.NOTIFICATION_SELF_READ), notificationController.getMyNotifications)
router.get('/unread-count', requirePermissions(PERMISSIONS.NOTIFICATION_SELF_READ), notificationController.getUnreadCount)
router.patch('/read-all', requirePermissions(PERMISSIONS.NOTIFICATION_SELF_UPDATE), notificationController.markAllNotificationsAsRead)
router.patch('/:id/read', requirePermissions(PERMISSIONS.NOTIFICATION_SELF_UPDATE), validateObjectId('id'), notificationController.markNotificationAsRead)
router.delete('/:id', requirePermissions(PERMISSIONS.NOTIFICATION_SELF_DELETE), validateObjectId('id'), notificationController.deleteNotification)

export default router

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: API thông báo của người dùng đã đăng nhập
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
 *         targetType: { type: string, enum: [USER, SHOP, PRODUCT, ORDER, PAYMENT, WALLET, WITHDRAWAL, KYC, CHAT, REVIEW, REPORT, VOUCHER, NOTIFICATION, SYSTEM] }
 *         targetId: { type: string, nullable: true }
 *         targetUrl: { type: string, nullable: true, example: /orders/64f000000000000000000001 }
 *         metadata: { type: object }
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
 *       200: { description: Đã đánh dấu thông báo là đã đọc }
 *       404: { description: Thông báo không thuộc về người dùng hiện tại hoặc không tồn tại }
 * /notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo của tôi là đã đọc
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Đã đánh dấu tất cả thông báo là đã đọc }
 * /notifications/{id}:
 *   delete:
 *     summary: Xóa một thông báo của tôi
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Đã xóa thông báo }
 *       404: { description: Thông báo không thuộc về người dùng hiện tại hoặc không tồn tại }
 */
