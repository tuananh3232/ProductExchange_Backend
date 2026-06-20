import { Router } from 'express'
import * as authController from '../../controllers/auth/auth.controller.js'
import * as optionsController from '../../controllers/options/options.controller.js'
import * as shopController from '../../controllers/shop/shop.controller.js'
import * as walletController from '../../controllers/wallet/wallet.controller.js'
import * as userWalletController from '../../controllers/user-wallet/user-wallet.controller.js'
import * as productController from '../../controllers/product/product.controller.js'
import * as orderController from '../../controllers/order/order.controller.js'
import * as paymentController from '../../controllers/payment/payment.controller.js'
import * as categoryController from '../../controllers/category/category.controller.js'
import * as adminAuditController from '../../controllers/admin/admin-audit.controller.js'
import * as adminFeePolicyController from '../../controllers/admin/admin-fee-policy.controller.js'
import * as adminPlatformLedgerController from '../../controllers/admin/admin-platform-ledger.controller.js'
import * as adminExchangeController from '../../controllers/admin/admin-exchange.controller.js'
import * as adminReportController from '../../controllers/admin/admin-report.controller.js'
import * as adminNotificationController from '../../controllers/admin/admin-notification.controller.js'
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { banUserSchema, rejectKycSchema } from '../../validations/auth/auth.validation.js'
import { rejectShopSchema, suspendShopSchema } from '../../validations/shop/shop.validation.js'
import {
  adminKycQuerySchema,
  adminCategoriesQuerySchema,
  adminCategoryCreateSchema,
  adminFeePoliciesQuerySchema,
  adminFeePolicyCreateSchema,
  adminFeePolicyPreviewSchema,
  adminFeePolicyUpdateSchema,
  adminPlatformLedgerQuerySchema,
  adminCategoryStatusSchema,
  adminCategoryUpdateSchema,
  adminOrderActionSchema,
  adminOrdersQuerySchema,
  adminOrderStatusSchema,
  adminPaymentsQuerySchema,
  adminActivityQuerySchema,
  adminAuditQuerySchema,
  adminNotificationCreateSchema,
  adminNotificationQuerySchema,
  adminReportExportQuerySchema,
  adminPaymentReconcileSchema,
  adminPaymentStatusSchema,
  adminProductStatusSchema,
  adminProductsQuerySchema,
  adminShopsQuerySchema,
  adminUserStatusSchema,
  adminUsersQuerySchema,
  adminWithdrawalsQuerySchema,
} from '../../validations/admin/admin.validation.js'
import {
  adminExchangeOffersQuerySchema,
  adminResolveExchangeDisputeSchema,
} from '../../validations/exchange/exchange.validation.js'
import { ROLES } from '../../constants/role.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import adminStatsRoutes from './stats.route.js'
import Joi from 'joi'

const rejectWithdrawalSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(1).max(500).required(),
  adminNote: Joi.string().trim().max(500).allow('').optional(),
})

const completeWithdrawalSchema = Joi.object({
  adminNote: Joi.string().trim().max(500).allow('').optional(),
  transferProof: Joi.object({
    transactionId: Joi.string().trim().max(100).optional(),
    transferDate: Joi.date().optional(),
    bankTransferRef: Joi.string().trim().max(100).required(),
    note: Joi.string().trim().max(500).allow('').optional(),
  }).required(),
})

const rejectUserWithdrawalSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(1).max(500).required(),
  adminNote: Joi.string().trim().max(500).allow('').optional(),
})

const completeUserWithdrawalSchema = Joi.object({
  adminNote: Joi.string().trim().max(500).allow('').optional(),
  transferProof: Joi.object({
    transactionId: Joi.string().trim().max(100).optional(),
    transferDate: Joi.date().optional(),
    bankTransferRef: Joi.string().trim().max(100).required(),
    note: Joi.string().trim().max(500).allow('').optional(),
  }).required(),
})

const router = Router()

router.use('/stats', adminStatsRoutes)

const requireAdmin = requireRoles(ROLES.ADMIN)

/**
 * @swagger
 * tags:
 *   - name: Admin Users
 *     description: API quản trị người dùng
 *   - name: Admin Products
 *     description: API quản trị sản phẩm
 *   - name: Admin Shops
 *     description: API quản trị shop
 *   - name: Admin KYC
 *     description: API quản trị hồ sơ KYC
 *   - name: Admin Withdrawals
 *     description: API quan tri rut tien
 *   - name: Admin Categories
 *     description: API quan tri danh muc
 *   - name: Admin Orders
 *     description: API quan tri don hang
 *   - name: Admin Payments
 *     description: API quan tri thanh toan
 *   - name: Admin Reports
 *     description: API xuat bao cao quan tri
 *   - name: Admin Notifications
 *     description: API thong bao quan tri
 *   - name: Admin Audit Logs
 *     description: API nhat ky kiem tra quan tri
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Lấy danh sách người dùng
 *     tags: [Admin Users]
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
  '/users/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getAdminUsersFilterOptions
)

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Lay danh sach nhat ky kiem tra quan tri
 *     tags: [Admin Audit Logs]
 *     responses:
 *       200:
 *         description: Lay nhat ky kiem tra thanh cong
 */
router.get(
  '/audit-logs',
  authenticate,
  requireAdmin,
  validate(adminAuditQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminAuditController.getAuditLogs
)

/**
 * @swagger
 * /admin/reports/export:
 *   get:
 *     summary: Xuat bao cao quan tri
 *     tags: [Admin Reports]
 *     responses:
 *       200:
 *         description: Xuat bao cao thanh cong
 */
router.get(
  '/reports/export',
  authenticate,
  requireAdmin,
  validate(adminReportExportQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminReportController.exportReport
)

/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     summary: Lay danh sach thong bao quan tri
 *     tags: [Admin Notifications]
 *     responses:
 *       200:
 *         description: Lay danh sach thong bao thanh cong
 *   post:
 *     summary: Gui thong bao quan tri
 *     tags: [Admin Notifications]
 *     responses:
 *       201:
 *         description: Gui thong bao thanh cong
 */
router.get(
  '/notifications',
  authenticate,
  requireAdmin,
  validate(adminNotificationQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminNotificationController.getAdminNotifications
)

router.post(
  '/notifications',
  authenticate,
  requireAdmin,
  validate(adminNotificationCreateSchema, 'body', HTTP_STATUS.BAD_REQUEST),
  adminNotificationController.sendAdminNotification
)

router.get(
  '/users',
  authenticate,
  requireAdmin,
  validate(adminUsersQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  authController.getAdminUsers
)

router.get(
  '/users/:userId',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  authController.getAdminUserById
)

router.get(
  '/users/:userId/activity',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  validate(adminActivityQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminAuditController.getUserActivity
)

router.patch(
  '/users/:userId/status',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  validate(adminUserStatusSchema),
  authController.updateAdminUserStatus
)

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: Lấy danh sách tất cả sản phẩm
 *     tags: [Admin Products]
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
  requireAdmin,
  validate(adminProductsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  productController.getAdminProducts
)

router.get(
  '/products/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getProductFilterOptions
)

router.get(
  '/products/:productId',
  authenticate,
  requireAdmin,
  validateObjectId('productId'),
  productController.getAdminProductById
)

router.get(
  '/products/:productId/moderation-history',
  authenticate,
  requireAdmin,
  validateObjectId('productId'),
  validate(adminActivityQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminAuditController.getProductModerationHistory
)

router.patch(
  '/products/:productId/status',
  authenticate,
  requireAdmin,
  validateObjectId('productId'),
  validate(adminProductStatusSchema),
  productController.updateAdminProductStatus
)

router.patch(
  '/products/:productId/hide',
  authenticate,
  requireAdmin,
  validateObjectId('productId'),
  validate(adminOrderActionSchema),
  productController.hideAdminProduct
)

router.patch(
  '/products/:productId/restore',
  authenticate,
  requireAdmin,
  validateObjectId('productId'),
  validate(adminOrderActionSchema),
  productController.restoreAdminProduct
)

/**
 * @swagger
 * /admin/users/{userId}/ban:
 *   patch:
 *     summary: Khóa tài khoản người dùng
 *     tags: [Admin Users]
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
  requireAdmin,
  validateObjectId('userId'),
  validate(banUserSchema),
  authController.banUser
)

/**
 * @swagger
 * /admin/users/{userId}/unban:
 *   patch:
 *     summary: Mở khóa tài khoản người dùng
 *     tags: [Admin Users]
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
  requireAdmin,
  validateObjectId('userId'),
  authController.unbanUser
)

/**
 * @swagger
 * /admin/shops:
 *   get:
 *     summary: Lấy danh sách tất cả shop
 *     tags: [Admin Shops]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending_review, active, rejected, suspended]
 *       - in: query
 *         name: search
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
 *         description: Lấy danh sách shop thành công
 *
 * /admin/shops/{id}:
 *   get:
 *     summary: Lấy chi tiết shop
 *     tags: [Admin Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của shop
 *     responses:
 *       200:
 *         description: Lấy chi tiết shop thành công
 *       404:
 *         description: Không tìm thấy shop
 *
 * /admin/shops/{id}/approve:
 *   patch:
 *     summary: Duyệt shop
 *     tags: [Admin Shops]
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
 *     tags: [Admin Shops]
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
 *     tags: [Admin Shops]
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
  requireAdmin,
  validate(adminShopsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  shopController.getAdminShops
)

router.get(
  '/shops/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getShopFilterOptions
)

router.get(
  '/shops/:id',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  shopController.getAdminShopById
)

router.get(
  '/shops/:id/review-history',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(adminActivityQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminAuditController.getShopReviewHistory
)

router.patch(
  '/shops/:id/approve',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  shopController.approveShop
)

router.patch(
  '/shops/:id/reject',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(rejectShopSchema),
  shopController.rejectShop
)

router.patch(
  '/shops/:id/suspend',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(suspendShopSchema),
  shopController.suspendShop
)

router.patch(
  '/shops/:id/unsuspend',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  shopController.unsuspendShop
)

/**
 * @swagger
 * /admin/kyc:
 *   get:
 *     summary: Lấy danh sách hồ sơ KYC
 *     tags: [Admin KYC]
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
 *         description: Lấy danh sách KYC thành công
 *
 * /admin/users/{userId}/kyc:
 *   get:
 *     summary: Lấy hồ sơ KYC của người dùng
 *     tags: [Admin KYC]
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
 *     tags: [Admin KYC]
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
 *     tags: [Admin KYC]
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
  '/kyc/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getKycFilterOptions
)

router.get(
  '/kyc',
  authenticate,
  requireAdmin,
  validate(adminKycQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  authController.getAdminKycs
)

router.get(
  '/users/:userId/kyc',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  authController.adminGetUserKyc
)

router.patch(
  '/users/:userId/kyc/approve',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  authController.adminApproveKyc
)

router.patch(
  '/users/:userId/kyc/reject',
  authenticate,
  requireAdmin,
  validateObjectId('userId'),
  validate(rejectKycSchema),
  authController.adminRejectKyc
)

/**
 * @swagger
 * /admin/withdrawals:
 *   get:
 *     summary: Lấy danh sách lệnh rút tiền (admin)
 *     tags: [Admin Withdrawals]
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
 *     tags: [Admin Withdrawals]
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
 *     tags: [Admin Withdrawals]
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
 *     tags: [Admin Withdrawals]
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
  '/withdrawals/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getWithdrawalFilterOptions
)

router.get(
  '/withdrawals',
  authenticate,
  requireAdmin,
  validate(adminWithdrawalsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  walletController.adminGetWithdrawals
)

router.get(
  '/withdrawals/:withdrawalId',
  authenticate,
  requireAdmin,
  validateObjectId('withdrawalId'),
  walletController.adminGetWithdrawalById
)

router.patch(
  '/withdrawals/:id/approve',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  walletController.approveWithdrawal
)

router.patch(
  '/withdrawals/:id/reject',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(rejectWithdrawalSchema),
  walletController.rejectWithdrawal
)

router.patch(
  '/withdrawals/:id/complete',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(completeWithdrawalSchema),
  walletController.completeWithdrawal
)

/**
 * @swagger
 * /admin/user-withdrawals:
 *   get:
 *     summary: Lấy danh sách yêu cầu rút tiền ví cá nhân (admin)
 *     tags: [Admin Withdrawals]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, completed]
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *
 * /admin/user-withdrawals/{id}/approve:
 *   patch:
 *     summary: Duyệt yêu cầu rút tiền ví cá nhân (pending → approved)
 *     tags: [Admin Withdrawals]
 *
 * /admin/user-withdrawals/{id}/reject:
 *   patch:
 *     summary: Từ chối yêu cầu rút tiền ví cá nhân (pending → rejected, hoàn tiền về ví)
 *     tags: [Admin Withdrawals]
 *
 * /admin/user-withdrawals/{id}/complete:
 *   patch:
 *     summary: Xác nhận đã chuyển tiền (approved → completed)
 *     tags: [Admin Withdrawals]
 */
router.get(
  '/user-withdrawals',
  authenticate,
  requireAdmin,
  validate(adminWithdrawalsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  userWalletController.adminGetUserWithdrawals
)

router.patch(
  '/user-withdrawals/:id/approve',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  userWalletController.approveUserWithdrawal
)

router.patch(
  '/user-withdrawals/:id/reject',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(rejectUserWithdrawalSchema),
  userWalletController.rejectUserWithdrawal
)

router.patch(
  '/user-withdrawals/:id/complete',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(completeUserWithdrawalSchema),
  userWalletController.completeUserWithdrawal
)

router.get(
  '/orders',
  authenticate,
  requireAdmin,
  validate(adminOrdersQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  orderController.getAdminOrders
)

router.get(
  '/orders/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getOrderFilterOptions
)

router.get(
  '/orders/:orderId',
  authenticate,
  requireAdmin,
  validateObjectId('orderId'),
  orderController.getAdminOrderById
)

router.patch(
  '/orders/:orderId/status',
  authenticate,
  requireAdmin,
  validateObjectId('orderId'),
  validate(adminOrderStatusSchema),
  orderController.updateAdminOrderStatus
)

router.patch(
  '/orders/:orderId/cancel',
  authenticate,
  requireAdmin,
  validateObjectId('orderId'),
  validate(adminOrderActionSchema),
  orderController.cancelAdminOrder
)

router.patch(
  '/orders/:orderId/refund',
  authenticate,
  requireAdmin,
  validateObjectId('orderId'),
  validate(adminOrderActionSchema),
  orderController.refundAdminOrder
)

router.get(
  '/payments',
  authenticate,
  requireAdmin,
  validate(adminPaymentsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  paymentController.getAdminPayments
)

router.get(
  '/payments/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getPaymentOptions
)

router.get(
  '/payments/:paymentId',
  authenticate,
  requireAdmin,
  validateObjectId('paymentId'),
  paymentController.getAdminPaymentById
)

router.patch(
  '/payments/:paymentId/status',
  authenticate,
  requireAdmin,
  validateObjectId('paymentId'),
  validate(adminPaymentStatusSchema),
  paymentController.updateAdminPaymentStatus
)

router.post(
  '/payments/:paymentId/reconcile',
  authenticate,
  requireAdmin,
  validateObjectId('paymentId'),
  validate(adminPaymentReconcileSchema),
  paymentController.reconcileAdminPayment
)

router.get(
  '/shop-withdrawals',
  authenticate,
  requireAdmin,
  validate(adminWithdrawalsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  walletController.adminGetWithdrawals
)

router.get(
  '/shop-withdrawals/:withdrawalId',
  authenticate,
  requireAdmin,
  validateObjectId('withdrawalId'),
  walletController.adminGetWithdrawalById
)

router.patch(
  '/shop-withdrawals/:id/approve',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  walletController.approveWithdrawal
)

router.patch(
  '/shop-withdrawals/:id/reject',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(rejectWithdrawalSchema),
  walletController.rejectWithdrawal
)

router.patch(
  '/shop-withdrawals/:id/complete',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  validate(completeWithdrawalSchema),
  walletController.completeWithdrawal
)

router.get(
  '/user-withdrawals/:withdrawalId',
  authenticate,
  requireAdmin,
  validateObjectId('withdrawalId'),
  userWalletController.adminGetUserWithdrawalById
)

router.get(
  '/fee-policies',
  authenticate,
  requireAdmin,
  validate(adminFeePoliciesQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminFeePolicyController.getFeePolicies
)

router.post(
  '/fee-policies',
  authenticate,
  requireAdmin,
  validate(adminFeePolicyCreateSchema),
  adminFeePolicyController.createFeePolicy
)

router.post(
  '/fee-policies/preview',
  authenticate,
  requireAdmin,
  validate(adminFeePolicyPreviewSchema),
  adminFeePolicyController.previewFee
)

router.post(
  '/fee-policies/seed',
  authenticate,
  requireAdmin,
  adminFeePolicyController.seedDefaultSaleFeePolicies
)

router.get(
  '/fee-policies/:feePolicyId',
  authenticate,
  requireAdmin,
  validateObjectId('feePolicyId'),
  adminFeePolicyController.getFeePolicyById
)

router.patch(
  '/fee-policies/:feePolicyId',
  authenticate,
  requireAdmin,
  validateObjectId('feePolicyId'),
  validate(adminFeePolicyUpdateSchema),
  adminFeePolicyController.updateFeePolicy
)

router.post(
  '/fee-policies/:feePolicyId/disable',
  authenticate,
  requireAdmin,
  validateObjectId('feePolicyId'),
  adminFeePolicyController.disableFeePolicy
)

router.get(
  '/platform-ledger',
  authenticate,
  requireAdmin,
  validate(adminPlatformLedgerQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminPlatformLedgerController.getPlatformLedgerTransactions
)

router.get(
  '/platform-ledger/:transactionId',
  authenticate,
  requireAdmin,
  validateObjectId('transactionId'),
  adminPlatformLedgerController.getPlatformLedgerTransactionById
)

router.get(
  '/platform-wallet/summary',
  authenticate,
  requireAdmin,
  adminPlatformLedgerController.getPlatformWalletSummary
)

router.get(
  '/platform-wallet/export',
  authenticate,
  requireAdmin,
  adminPlatformLedgerController.exportPlatformLedger
)

router.get(
  '/exchanges',
  authenticate,
  requireAdmin,
  validate(adminExchangeOffersQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  adminExchangeController.getAdminExchangeOffers
)

router.get(
  '/exchanges/:exchangeOfferId',
  authenticate,
  requireAdmin,
  validateObjectId('exchangeOfferId'),
  adminExchangeController.getAdminExchangeOfferById
)

router.post(
  '/exchanges/:exchangeOfferId/resolve',
  authenticate,
  requireAdmin,
  validateObjectId('exchangeOfferId'),
  validate(adminResolveExchangeDisputeSchema),
  adminExchangeController.resolveAdminExchangeDispute
)

router.get(
  '/categories',
  authenticate,
  requireAdmin,
  validate(adminCategoriesQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST),
  categoryController.getAdminCategories
)

router.get(
  '/categories/filter-options',
  authenticate,
  requireAdmin,
  optionsController.getCategoryFilterOptions
)

router.get(
  '/categories/:categoryId',
  authenticate,
  requireAdmin,
  validateObjectId('categoryId'),
  categoryController.getAdminCategoryById
)

router.post(
  '/categories',
  authenticate,
  requireAdmin,
  validate(adminCategoryCreateSchema),
  categoryController.createCategory
)

router.patch(
  '/categories/:categoryId',
  authenticate,
  requireAdmin,
  validateObjectId('categoryId'),
  validate(adminCategoryUpdateSchema),
  categoryController.updateCategory
)

router.patch(
  '/categories/:categoryId/status',
  authenticate,
  requireAdmin,
  validateObjectId('categoryId'),
  validate(adminCategoryStatusSchema),
  categoryController.updateAdminCategoryStatus
)

export default router
