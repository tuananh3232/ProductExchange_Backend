import { Router } from 'express'
import * as exchangeController from '../../controllers/exchange/exchange.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { createExchangeSchema, respondExchangeSchema } from '../../validations/exchange/exchange.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

// Tất cả exchange routes đều cần đăng nhập
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Exchanges
 *   description: API Trao đổi sản phẩm
 */

/**
 * @swagger
 * /exchanges:
 *   get:
 *     summary: Lấy danh sách đề xuất
 *     tags: [Exchanges]
 *     responses:
 *       200:
 *         description: Thành công
 *   post:
 *     summary: Gửi đề xuất trao đổi
 *     tags: [Exchanges]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestedProduct:
 *                 type: string
 *               offeredProduct:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thành công
 */
router.get('/', requirePermissions(PERMISSIONS.EXCHANGE_READ), exchangeController.getExchanges)
router.post(
	'/',
	requirePermissions(PERMISSIONS.EXCHANGE_CREATE),
	validate(createExchangeSchema),
	exchangeController.createExchange
)

/**
 * @swagger
 * /exchanges/{id}:
 *   get:
 *     summary: Chi tiết đề xuất
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/:id', requirePermissions(PERMISSIONS.EXCHANGE_READ), exchangeController.getExchangeById)

/**
 * @swagger
 * /exchanges/{id}/respond:
 *   patch:
 *     summary: Chấp nhận hoặc từ chối đề xuất
 *     tags: [Exchanges]
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
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch(
	'/:id/respond',
	requirePermissions(PERMISSIONS.EXCHANGE_RESPOND),
	validate(respondExchangeSchema),
	exchangeController.respondToExchange
)

/**
 * @swagger
 * /exchanges/{id}/complete:
 *   patch:
 *     summary: Xác nhận hoàn tất
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch('/:id/complete', requirePermissions(PERMISSIONS.EXCHANGE_COMPLETE), exchangeController.completeExchange)

/**
 * @swagger
 * /exchanges/{id}/cancel:
 *   patch:
 *     summary: Huỷ đề xuất
 *     tags: [Exchanges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch('/:id/cancel', requirePermissions(PERMISSIONS.EXCHANGE_CREATE), exchangeController.cancelExchange)

export default router
