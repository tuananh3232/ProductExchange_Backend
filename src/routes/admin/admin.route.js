import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import * as shopController from '../../controllers/shop/shop.controller.js'
import * as productController from '../../controllers/product/product.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { banUserSchema, rejectKycSchema } from '../../validations/auth/auth.validation.js'
import { rejectShopSchema, suspendShopSchema } from '../../validations/shop/shop.validation.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import adminStatsRoutes from './stats.route.js'

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

export default router
