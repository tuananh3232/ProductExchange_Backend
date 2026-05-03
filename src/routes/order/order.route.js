import { Router } from 'express'
import * as orderController from '../../controllers/order/order.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  cancelOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
} from '../../validations/order/order.validation.js'
const router = Router()

router.use(authenticate)

router.post('/', validate(createOrderSchema), orderController.createOrder)
router.get('/', orderController.getOrders)
router.get('/:id', orderController.getOrderById)
router.patch('/:id/confirm', orderController.confirmOrder)
router.patch('/:id/cancel', validate(cancelOrderSchema), orderController.cancelOrder)
router.patch(
  '/:id/status',
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
)

export default router

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: API quản lý đơn hàng
 *
 * /orders:
 *   post:
 *     summary: Tạo đơn hàng
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product, quantity, shippingAddress]
 *             properties:
 *               product:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               shippingAddress:
 *                 type: object
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo đơn hàng thành công
 *   get:
 *     summary: Lấy danh sách đơn hàng
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy danh sách đơn hàng thành công
 *
 * /orders/{id}:
 *   get:
 *     summary: Xem chi tiết đơn hàng
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết đơn hàng thành công
 *
 * /orders/{id}/confirm:
 *   patch:
 *     summary: Shop xác nhận đơn hàng
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xác nhận đơn hàng thành công
 *
 * /orders/{id}/cancel:
 *   patch:
 *     summary: Hủy đơn hàng
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hủy đơn hàng thành công
 *
 * /orders/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái đơn hàng
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái đơn hàng thành công
 */
