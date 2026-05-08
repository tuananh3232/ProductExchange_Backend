import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { authRateLimit } from '../../middlewares/rate-limit.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import {
	registerSchema,
	loginSchema,
	refreshTokenSchema,
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
router.post('/register', authRateLimit, validate(registerSchema), authController.register)

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
router.post('/login', authRateLimit, validate(loginSchema), authController.login)

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
router.post('/google/login', authRateLimit, validate(googleLoginSchema), authController.googleLogin)

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
router.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), authController.forgotPassword)

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
 *             required: [email, otp, newPassword, confirmNewPassword]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmNewPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 */
router.post('/reset-password', authRateLimit, validate(resetPasswordSchema), authController.resetPassword)

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

export default router
