import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import * as shopController from '../../controllers/shop/shop.controller.js'
<<<<<<< HEAD
import * as productController from '../../controllers/product/product.controller.js'
=======
import * as walletController from '../../controllers/wallet/wallet.controller.js'
>>>>>>> baonq
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { banUserSchema, rejectKycSchema } from '../../validations/auth/auth.validation.js'
import { rejectShopSchema, suspendShopSchema } from '../../validations/shop/shop.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import adminStatsRoutes from './stats.route.js'
import Joi from 'joi'

const rejectWithdrawalSchema = Joi.object({
  rejectionReason: Joi.string().min(1).required(),
  adminNote: Joi.string().allow('').optional(),
})

const completeWithdrawalSchema = Joi.object({
  adminNote: Joi.string().allow('').optional(),
  transferProof: Joi.object({
    transactionId: Joi.string().max(100).optional(),
    transferDate: Joi.date().optional(),
    bankTransferRef: Joi.string().max(100).optional(),
    note: Joi.string().max(500).allow('').optional(),
  }).optional(),
})

const router = Router()

router.use('/stats', adminStatsRoutes)

/**
 * @swagger
 * tags:
 *   - name: Admin - Users
 *     description: API quản trị người dùng
 *   - name: Admin - Products
 *     description: API quản trị sản phẩm
 *   - name: Admin - Shops
 *     description: API quản trị shop
 *   - name: Admin - KYC
 *     description: API quản trị hồ sơ KYC
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     tags: [Admin - Users]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
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
 *         description: Lấy danh sách người dùng thành công
 */
router.get(
  '/users',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  authController.getAdminUsers
)

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: Lấy danh sách tất cả sản phẩm
 *     tags: [Admin - Products]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: string
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
 *         description: Lấy danh sách sản phẩm thành công
 */
router.get(
  '/products',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_PRODUCTS),
  productController.getAdminProducts
)

/**
 * @swagger
 * /admin/users/{userId}/ban:
 *   patch:
 *     summary: Khóa tài khoản người dùng
 *     tags: [Admin - Users]
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
 *     tags: [Admin - Users]
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

/**
 * @swagger
 * /admin/shops:
 *   get:
 *     summary: Lấy danh sách tất cả shop
 *     tags: [Admin - Shops]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_review, active, rejected, suspended]
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
 *         description: Lấy danh sách shop thành công
 *
 * /admin/shops/{id}/approve:
 *   patch:
 *     summary: Duyệt shop
 *     tags: [Admin - Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Duyệt shop thành công
 *
 * /admin/shops/{id}/reject:
 *   patch:
 *     summary: Từ chối shop
 *     tags: [Admin - Shops]
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
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Từ chối shop thành công
 *
 * /admin/shops/{id}/suspend:
 *   patch:
 *     summary: Đình chỉ shop
 *     tags: [Admin - Shops]
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đình chỉ shop thành công
 */
router.get(
  '/shops',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_SHOPS),
  shopController.getAdminShops
)

router.patch(
  '/shops/:id/approve',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_SHOPS),
  shopController.approveShop
)

router.patch(
  '/shops/:id/reject',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_SHOPS),
  validate(rejectShopSchema),
  shopController.rejectShop
)

router.patch(
  '/shops/:id/suspend',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_SHOPS),
  validate(suspendShopSchema),
  shopController.suspendShop
)

router.patch(
  '/shops/:id/unsuspend',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_SHOPS),
  shopController.unsuspendShop
)

/**
 * @swagger
 * /admin/kyc:
 *   get:
 *     summary: Lay danh sach ho so KYC
 *     tags: [Admin - KYC]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, none]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Lay danh sach KYC thanh cong
 *
 * /admin/users/{userId}/kyc:
 *   get:
 *     summary: Lấy hồ sơ KYC của người dùng
 *     tags: [Admin - KYC]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy KYC thành công
 *
 * /admin/users/{userId}/kyc/approve:
 *   patch:
 *     summary: Duyệt hồ sơ KYC
 *     tags: [Admin - KYC]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Duyệt KYC thành công
 *
 * /admin/users/{userId}/kyc/reject:
 *   patch:
 *     summary: Từ chối hồ sơ KYC
 *     tags: [Admin - KYC]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Từ chối KYC thành công
 */
router.get(
  '/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  authController.getAdminKycs
)

router.get(
  '/users/:userId/kyc',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  authController.adminGetUserKyc
)

router.patch(
  '/users/:userId/kyc/approve',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  authController.adminApproveKyc
)

router.patch(
  '/users/:userId/kyc/reject',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_USERS),
  validate(rejectKycSchema),
  authController.adminRejectKyc
)

/**
 * @swagger
 * /admin/withdrawals:
 *   get:
 *     summary: Lấy danh sách lệnh rút tiền (admin)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, processing, completed]
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *
 * /admin/withdrawals/{id}/approve:
 *   patch:
 *     summary: Duyệt lệnh rút tiền (pending → approved)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lệnh rút tiền
 *     responses:
 *       200:
 *         description: Duyệt thành công
 *
 * /admin/withdrawals/{id}/reject:
 *   patch:
 *     summary: Từ chối lệnh rút tiền (pending/approved → rejected, hoàn tiền về ví)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lệnh rút tiền
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rejectionReason]
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: Thông tin tài khoản ngân hàng không hợp lệ
 *               adminNote:
 *                 type: string
 *                 example: ""
 *     responses:
 *       200:
 *         description: Từ chối thành công, tiền hoàn về ví shop
 *
 * /admin/withdrawals/{id}/complete:
 *   patch:
 *     summary: Xác nhận đã chuyển tiền (approved → completed)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lệnh rút tiền
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNote:
 *                 type: string
 *                 example: Đã chuyển khoản thành công
 *               transferProof:
 *                 type: object
 *                 properties:
 *                   transactionId:
 *                     type: string
 *                     example: TXN20250525001
 *                   transferDate:
 *                     type: string
 *                     format: date-time
 *                     example: "2025-05-25T10:00:00Z"
 *                   bankTransferRef:
 *                     type: string
 *                     example: REF123456
 *                   note:
 *                     type: string
 *                     example: ""
 *     responses:
 *       200:
 *         description: Xác nhận thành công, pendingBalance về 0, totalWithdrawn tăng
 */
router.get(
  '/withdrawals',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_WITHDRAWALS),
  walletController.adminGetWithdrawals
)

router.patch(
  '/withdrawals/:id/approve',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_WITHDRAWALS),
  walletController.approveWithdrawal
)

router.patch(
  '/withdrawals/:id/reject',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_WITHDRAWALS),
  validate(rejectWithdrawalSchema),
  walletController.rejectWithdrawal
)

router.patch(
  '/withdrawals/:id/complete',
  authenticate,
  requirePermissions(PERMISSIONS.ADMIN_MANAGE_WITHDRAWALS),
  validate(completeWithdrawalSchema),
  walletController.completeWithdrawal
)

export default router
