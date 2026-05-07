import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { uploadKycImages } from '../../middlewares/upload.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import {
	registerSchema,
	loginSchema,
	refreshTokenSchema,
	changePasswordSchema,
	updateProfileSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	sendVerificationEmailSchema,
	verifyEmailSchema,
	googleLoginSchema,
} from '../../validations/auth/auth.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API xác thực người dùng
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Đăng ký tài khoản
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Đăng ký tài khoản thành công
 *               data:
 *                 user:
 *                   id: "..."
 *                   name: "..."
 *                   email: "..."
 *                   role: user
 */
router.post('/register', validate(registerSchema), authController.register)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 */
router.post('/login', validate(loginSchema), authController.login)

/**
 * @swagger
 * /auth/google/login:
 *   post:
 *     summary: Đăng nhập bằng Google
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập Google thành công
 */
router.post('/google/login', validate(googleLoginSchema), authController.googleLogin)

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken)

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi yêu cầu thành công
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword)

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword, confirmNewPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword)

/**
 * @swagger
 * /auth/send-verification-email:
 *   post:
 *     summary: Gửi mã OTP xác minh tài khoản
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Gửi mã xác minh thành công
 */
router.post('/send-verification-email', validate(sendVerificationEmailSchema), authController.sendVerificationEmail)

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Xác minh email bằng mã OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Xác minh email thành công
 */
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/logout', authenticate, requirePermissions(PERMISSIONS.AUTH_LOGOUT), authController.logout)

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Lấy thông tin cá nhân
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/me', authenticate, requirePermissions(PERMISSIONS.USER_READ), authController.getMe)

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Auth]
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
	authController.updateProfile
)

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
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
	authController.changePassword
)

/**
 * @swagger
 * /auth/kyc:
 *   post:
 *     summary: Nộp hồ sơ xác minh danh tính (CCCD)
 *     tags: [Auth]
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
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Lấy KYC thành công
 */
router.post(
  '/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.USER_UPDATE),
  uploadKycImages,
  authController.submitKyc
)

router.get(
  '/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.USER_READ),
  authController.getMyKyc
)

export default router
