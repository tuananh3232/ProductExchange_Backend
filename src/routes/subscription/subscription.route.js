import { Router } from 'express'
import * as subscriptionController from '../../controllers/subscription/subscription.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import Joi from 'joi'

const router = Router()

const checkoutSchema = Joi.object({
  plan: Joi.string().valid('monthly', 'yearly').required(),
  paymentMethod: Joi.string().valid('payos', 'wallet').optional(),
})

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: API đăng ký VIP để sử dụng tính năng 2D Room Visualizer
 */

/**
 * @swagger
 * /subscriptions/me:
 *   get:
 *     summary: Xem trạng thái VIP hiện tại của bản thân
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin VIP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isActive:
 *                   type: boolean
 *                 plan:
 *                   type: string
 *                   enum: [monthly, yearly]
 *                   nullable: true
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 daysLeft:
 *                   type: integer
 */
router.get('/me', authenticate, subscriptionController.getMySubscription)

/**
 * @swagger
 * /subscriptions/checkout:
 *   post:
 *     summary: Tạo đơn đăng ký VIP và lấy link thanh toán PayOS
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [monthly, yearly]
 *                 description: "monthly = 69.000đ/tháng | yearly = 499.000đ/năm"
 *     responses:
 *       200:
 *         description: Tạo link thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 paymentUrl:
 *                   type: string
 *                   description: Link redirect đến trang thanh toán PayOS
 *                 plan:
 *                   type: string
 */
router.post('/checkout', authenticate, validate(checkoutSchema), subscriptionController.checkout)

/**
 * @swagger
 * /subscriptions/payos/return:
 *   get:
 *     summary: Xử lý kết quả trả về từ PayOS sau khi thanh toán VIP
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: cancel
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Kết quả xử lý thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                   enum: [completed, cancelled, pending]
 *                 plan:
 *                   type: string
 *                   nullable: true
 */
router.get('/payos/return', authenticate, subscriptionController.payosReturn)

/**
 * @swagger
 * /subscriptions/payos/cancel:
 *   get:
 *     summary: Xử lý khi người dùng huỷ thanh toán VIP
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Xử lý huỷ thành công
 */
router.get('/payos/cancel', authenticate, subscriptionController.payosReturn)

/**
 * @swagger
 * /subscriptions/payos/webhook:
 *   post:
 *     summary: Webhook server-to-server từ PayOS (đăng ký URL này trong PayOS dashboard)
 *     tags: [Subscriptions]
 *     responses:
 *       200:
 *         description: Xử lý webhook thành công
 */
router.post('/payos/webhook', subscriptionController.webhook)

export default router
