import { Router } from 'express'
import * as paymentController from '../../controllers/payment/payment.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import Joi from 'joi'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: API thanh toán đơn hàng bằng VNPay
 */

const createPaymentSchema = Joi.object({
	orderId: Joi.string().hex().length(24).required(),
})

/**
 * @swagger
 * /payments/vnpay/create:
 *   post:
 *     summary: Tạo yêu cầu thanh toán VNPay
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo payment URL thành công
 */
router.post('/vnpay/create', authenticate, validate(createPaymentSchema), paymentController.createVnpayPayment)

/**
 * @swagger
 * /payments/vnpay/return:
 *   get:
 *     summary: Xử lý kết quả trả về từ VNPay
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Xử lý callback thành công
 */
router.get('/vnpay/return', paymentController.vnpayReturn)

/**
 * @swagger
 * /payments/vnpay/ipn:
 *   post:
 *     summary: Nhận callback server-to-server từ VNPay
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Xử lý IPN thành công
 */
router.post('/vnpay/ipn', paymentController.vnpayIpn)

export default router