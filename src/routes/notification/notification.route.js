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
 *     description: Authenticated user notifications
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
 *     summary: Get my notifications
 *     tags: [Notifications]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *       - { in: query, name: isRead, schema: { type: boolean } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: targetType, schema: { type: string } }
 *     responses:
 *       200: { description: Notifications with pagination and unread count }
 * /notifications/unread-count:
 *   get:
 *     summary: Get my unread notification count
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Unread count }
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark one of my notifications as read
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Notification marked as read }
 *       404: { description: Notification does not belong to current user or does not exist }
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all my notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Notifications marked as read }
 * /notifications/{id}:
 *   delete:
 *     summary: Delete one of my notifications
 *     tags: [Notifications]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Notification deleted }
 *       404: { description: Notification does not belong to current user or does not exist }
 */
