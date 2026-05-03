import { Router } from 'express'
import * as deliveryController from '../../controllers/delivery/delivery.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  assignDeliverySchema,
  deliveryNoteSchema,
  updateDeliveryStatusSchema,
} from '../../validations/delivery/delivery.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

router.use(authenticate)

router.post('/assign', requirePermissions(PERMISSIONS.DELIVERY_ASSIGN), validate(assignDeliverySchema), deliveryController.assignDelivery)
router.get('/me', requirePermissions(PERMISSIONS.DELIVERY_READ), deliveryController.getMyDeliveries)
router.get('/:id', requirePermissions(PERMISSIONS.DELIVERY_READ), deliveryController.getDeliveryById)
router.patch('/:id/accept', requirePermissions(PERMISSIONS.DELIVERY_ACCEPT), deliveryController.acceptDelivery)
router.patch('/:id/pickup', requirePermissions(PERMISSIONS.DELIVERY_PICKUP), validate(deliveryNoteSchema), deliveryController.pickupOrder)
router.patch(
  '/:id/status',
  requirePermissions(PERMISSIONS.DELIVERY_UPDATE_STATUS),
  validate(updateDeliveryStatusSchema),
  deliveryController.updateDeliveryStatus
)
router.patch('/:id/complete', requirePermissions(PERMISSIONS.DELIVERY_COMPLETE), validate(deliveryNoteSchema), deliveryController.completeDelivery)

export default router

/**
 * @swagger
 * tags:
 *   name: Deliveries
 *   description: API quản lý giao hàng
 *
 * /deliveries/assign:
 *   post:
 *     summary: Gán đơn cho nhân viên giao hàng
 *     tags: [Deliveries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, deliveryStaffId]
 *             properties:
 *               orderId:
 *                 type: string
 *               deliveryStaffId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gán đơn thành công
 *
 * /deliveries/me:
 *   get:
 *     summary: Xem danh sách đơn giao của tôi
 *     tags: [Deliveries]
 *     responses:
 *       200:
 *         description: Lấy danh sách đơn giao thành công
 *
 * /deliveries/{id}:
 *   get:
 *     summary: Xem chi tiết đơn giao
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết đơn giao thành công
 *
 * /deliveries/{id}/accept:
 *   patch:
 *     summary: Nhân viên giao hàng nhận đơn
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Nhận đơn thành công
 *
 * /deliveries/{id}/pickup:
 *   patch:
 *     summary: Cập nhật trạng thái lấy hàng
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật lấy hàng thành công
 *
 * /deliveries/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái giao hàng
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái giao hàng thành công
 *
 * /deliveries/{id}/complete:
 *   patch:
 *     summary: Hoàn tất đơn giao
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hoàn tất đơn giao thành công
 */
