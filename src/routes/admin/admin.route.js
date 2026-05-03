import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { banUserSchema } from '../../validations/auth/auth.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import adminStatsRoutes from './stats.route.js'

const router = Router()

router.use('/stats', adminStatsRoutes)

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Các API quản trị hệ thống (chỉ admin mới dùng được)
 */

/**
 * @swagger
 * /admin/users/{userId}/ban:
 *   patch:
 *     summary: Khóa tài khoản người dùng
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Khóa tài khoản thành công
 *       403:
 *         description: Không có quyền
 */
router.patch(
  '/users/:userId/ban',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  validate(banUserSchema),
  authController.banUser
)

/**
 * @swagger
 * /admin/users/{userId}/unban:
 *   patch:
 *     summary: Mở khóa tài khoản người dùng
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mở khóa tài khoản thành công
 *       403:
 *         description: Không có quyền
 */
router.patch(
  '/users/:userId/unban',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  authController.unbanUser
)

export default router
