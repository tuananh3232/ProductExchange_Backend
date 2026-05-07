import { Router } from 'express'
import * as userController from '../../controllers/user/user.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { uploadKycImages } from '../../middlewares/upload.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import {
  changePasswordSchema,
  updateProfileSchema,
} from '../../validations/auth/auth.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API quản lý thông tin cá nhân
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Lấy thông tin cá nhân
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/me', authenticate, requirePermissions(PERMISSIONS.USER_READ), userController.getMe)

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   province:
 *                     type: string
 *                   district:
 *                     type: string
 *                   detail:
 *                     type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put(
  '/profile',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  validate(updateProfileSchema),
  userController.updateProfile
)

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     summary: Đổi mật khẩu
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 */
router.post(
  '/change-password',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  validate(changePasswordSchema),
  userController.changePassword
)

/**
 * @swagger
 * /users/kyc:
 *   post:
 *     summary: Nộp hồ sơ xác minh danh tính (CCCD)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fullName, idNumber, frontImage, backImage]
 *             properties:
 *               fullName:
 *                 type: string
 *               idNumber:
 *                 type: string
 *               frontImage:
 *                 type: string
 *                 format: binary
 *               backImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Nộp KYC thành công
 *   get:
 *     summary: Lấy trạng thái KYC của tôi
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lấy KYC thành công
 */
router.post(
  '/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  uploadKycImages,
  userController.submitKyc
)

router.get('/kyc', authenticate, requirePermissions(PERMISSIONS.USER_READ), userController.getMyKyc)

export default router
