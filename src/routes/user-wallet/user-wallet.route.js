import { Router } from 'express'
import * as userWalletController from '../../controllers/user-wallet/user-wallet.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import Joi from 'joi'

const router = Router()

const createTopupSchema = Joi.object({
  amount: Joi.number().integer().min(10000).max(50000000).required(),
})

const payOrderSchema = Joi.object({
  orderId: Joi.string().hex().length(24).required(),
})

const verifyTopupSchema = Joi.object({
  orderCode: Joi.number().required(),
})

const requestWithdrawalSchema = Joi.object({
  amount: Joi.number().integer().min(50000).max(50000000).required(),
  bankInfo: Joi.object({
    bankName: Joi.string().min(1).required(),
    accountNumber: Joi.string().min(1).required(),
    accountName: Joi.string().min(1).required(),
    bankBranch: Joi.string().allow('').optional(),
  }).required(),
  note: Joi.string().allow('').optional(),
})

/**
 * @swagger
 * tags:
 *   name: UserWallet
 *   description: API ví cá nhân người dùng
 */

/**
 * @swagger
 * /user-wallet/me:
 *   get:
 *     summary: Lấy thông tin ví cá nhân
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin ví thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance:
 *                       type: number
 *                       example: 500000
 *                     totalTopUp:
 *                       type: number
 *                       example: 1000000
 *                     totalSpent:
 *                       type: number
 *                       example: 500000
 */
router.get('/me', authenticate, userWalletController.getMyWallet)

/**
 * @swagger
 * /user-wallet/me/transactions:
 *   get:
 *     summary: Lấy lịch sử giao dịch ví
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lấy lịch sử giao dịch thành công
 */
router.get('/me/transactions', authenticate, userWalletController.getMyTransactions)

/**
 * @swagger
 * /user-wallet/me/activity:
 *   get:
 *     summary: Lấy lịch sử hoạt động ví tổng hợp
 *     description: |
 *       Trả về danh sách chuẩn hóa gồm cả wallet_transaction (giao dịch topup/payment/refund hoàn tất)
 *       và topup_attempt (phiên nạp tiền pending/failed/cancelled).
 *       Sắp xếp theo createdAt giảm dần.
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lấy lịch sử hoạt động ví thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       kind:
 *                         type: string
 *                         enum: [topup, payment, refund]
 *                       status:
 *                         type: string
 *                         enum: [pending, completed, failed, cancelled]
 *                       amount:
 *                         type: number
 *                       balanceBefore:
 *                         type: number
 *                         nullable: true
 *                       balanceAfter:
 *                         type: number
 *                         nullable: true
 *                       orderId:
 *                         type: string
 *                         nullable: true
 *                       orderCode:
 *                         type: number
 *                         nullable: true
 *                       description:
 *                         type: string
 *                       source:
 *                         type: string
 *                         enum: [wallet_transaction, topup_attempt]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/me/activity', authenticate, userWalletController.getMyActivity)

/**
 * @swagger
 * /user-wallet/me/topups:
 *   get:
 *     summary: Lấy lịch sử nạp tiền
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lấy lịch sử nạp tiền thành công
 */
router.get('/me/topups', authenticate, userWalletController.getMyTopups)

/**
 * @swagger
 * /user-wallet/me/topup:
 *   post:
 *     summary: Tạo yêu cầu nạp tiền vào ví (PayOS)
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 10000
 *                 maximum: 50000000
 *                 example: 100000
 *     responses:
 *       201:
 *         description: Tạo yêu cầu nạp tiền thành công, trả về URL thanh toán PayOS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     topup:
 *                       type: object
 *                     paymentUrl:
 *                       type: string
 *                       example: https://pay.payos.vn/web/...
 *       400:
 *         description: Số tiền không hợp lệ
 */
router.post('/me/topup', authenticate, validate(createTopupSchema), userWalletController.createTopup)

/**
 * @swagger
 * /user-wallet/me/pay-order:
 *   post:
 *     summary: Thanh toán đơn hàng bằng ví cá nhân
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: 6643f1a2b2c3d4e5f6a7b8c9
 *     responses:
 *       200:
 *         description: Thanh toán thành công
 *       400:
 *         description: Số dư không đủ hoặc đơn hàng không hợp lệ
 */
router.post('/me/pay-order', authenticate, validate(payOrderSchema), userWalletController.payOrderWithWallet)

/**
 * @swagger
 * /user-wallet/me/topup/verify:
 *   post:
 *     summary: Xác nhận trạng thái nạp tiền sau khi PayOS chuyển hướng về FE
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderCode]
 *             properties:
 *               orderCode:
 *                 type: number
 *                 example: 767114052
 *     responses:
 *       200:
 *         description: Xác nhận thành công, trả về trạng thái nạp tiền
 */
router.post('/me/topup/verify', authenticate, validate(verifyTopupSchema), userWalletController.verifyTopup)

/**
 * @swagger
 * /user-wallet/me/withdrawals:
 *   get:
 *     summary: Lấy danh sách yêu cầu rút tiền của tôi
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, completed]
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
 *         description: Lấy danh sách yêu cầu rút tiền thành công
 *   post:
 *     summary: Tạo yêu cầu rút tiền từ ví cá nhân
 *     tags: [UserWallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, bankInfo]
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 50000
 *                 maximum: 50000000
 *                 example: 200000
 *               bankInfo:
 *                 type: object
 *                 required: [bankName, accountNumber, accountName]
 *                 properties:
 *                   bankName:
 *                     type: string
 *                     example: Vietcombank
 *                   accountNumber:
 *                     type: string
 *                     example: "0123456789"
 *                   accountName:
 *                     type: string
 *                     example: NGUYEN VAN A
 *               note:
 *                 type: string
 *                 example: ""
 *     responses:
 *       201:
 *         description: Tạo yêu cầu rút tiền thành công
 *       400:
 *         description: Số dư không đủ hoặc đang có yêu cầu chờ xử lý
 */
router.post('/me/withdrawals', authenticate, validate(requestWithdrawalSchema), userWalletController.requestWithdrawal)
router.get('/me/withdrawals', authenticate, userWalletController.getMyWithdrawals)

export default router
