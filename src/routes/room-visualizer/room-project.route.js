import { Router } from 'express'
import * as roomProjectController from '../../controllers/room-visualizer/room-project.controller.js'
import { authenticate, requireVip } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import {
  createProjectSchema,
  updateProjectSchema,
} from '../../validations/room-visualizer/room-project.validation.js'
import roomSceneRoutes from './room-scene.route.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Room Visualizer
 *     description: API quản lý room project (tính năng VIP)
 */

/**
 * @swagger
 * /room-projects:
 *   get:
 *     summary: Lấy danh sách room project của tôi
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, active, archived] }
 *     responses:
 *       200:
 *         description: Lấy danh sách project thành công
 *       403:
 *         description: Tính năng chỉ dành cho tài khoản VIP
 *   post:
 *     summary: Tạo room project mới
 *     tags: [Room Visualizer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Tạo project thành công
 *       400:
 *         description: Đã đạt giới hạn số project
 *       403:
 *         description: Tính năng chỉ dành cho tài khoản VIP
 */
router.get('/', authenticate, requireVip, roomProjectController.list)
router.post('/', authenticate, requireVip, validate(createProjectSchema), roomProjectController.create)

/**
 * @swagger
 * /room-projects/{projectId}:
 *   get:
 *     summary: Lấy chi tiết room project
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết project thành công
 *       404:
 *         description: Project không tồn tại
 *   patch:
 *     summary: Cập nhật room project
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
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
 *               name:
 *                 type: string
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Cập nhật project thành công
 *       404:
 *         description: Project không tồn tại
 *   delete:
 *     summary: Xóa room project (chuyển sang archived)
 *     tags: [Room Visualizer]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa project thành công
 *       404:
 *         description: Project không tồn tại
 */
router.get('/:projectId', authenticate, requireVip, validateObjectId('projectId'), roomProjectController.getOne)
router.patch(
  '/:projectId',
  authenticate,
  requireVip,
  validateObjectId('projectId'),
  validate(updateProjectSchema),
  roomProjectController.update
)
router.delete('/:projectId', authenticate, requireVip, validateObjectId('projectId'), roomProjectController.remove)

router.use('/:projectId/scenes', roomSceneRoutes)

export default router
