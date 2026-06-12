import { Router } from 'express'
import * as walletController from '../../controllers/wallet/wallet.controller.js'
import { authenticate, requireShopPermission } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import Joi from 'joi'
import PERMISSIONS from '../../constants/permission.constant.js'

const router = Router()

const requestWithdrawalSchema = Joi.object({
  amount: Joi.number().integer().min(50000).max(50000000).required(),
  bankInfo: Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountName: Joi.string().required(),
    bankBranch: Joi.string().allow('').optional(),
  }).required(),
  note: Joi.string().allow('').optional(),
})

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

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: API quản lý ví shop
 */

/**
 * @swagger
 * /wallet/shops/{shopId}:
 *   get:
 *     summary: Lấy thông tin ví của shop
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
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
 *                     pendingBalance:
 *                       type: number
 *                     totalEarned:
 *                       type: number
 *                     totalWithdrawn:
 *                       type: number
 */
router.get(
  '/shops/:shopId',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_WALLET_READ, 'shopId'),
  walletController.getWallet
)

/**
 * @swagger
 * /wallet/shops/{shopId}/transactions:
 *   get:
 *     summary: Lấy lịch sử giao dịch của ví shop
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
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
router.get(
  '/shops/:shopId/transactions',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_WALLET_TRANSACTION_READ, 'shopId'),
  walletController.getTransactions
)

/**
 * @swagger
 * /wallet/shops/{shopId}/withdrawals:
 *   post:
 *     summary: Tạo lệnh rút tiền
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
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
 *                 example: 100000
 *               bankInfo:
 *                 type: object
 *                 required: [bankName, accountNumber, accountName]
 *                 properties:
 *                   bankName:
 *                     type: string
 *                     example: Vietcombank
 *                   accountNumber:
 *                     type: string
 *                     example: "1234567890"
 *                   accountName:
 *                     type: string
 *                     example: NGUYEN VAN A
 *                   bankBranch:
 *                     type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tạo lệnh rút tiền thành công
 *       400:
 *         description: Số dư không đủ hoặc đã có lệnh pending
 *   get:
 *     summary: Lấy danh sách lệnh rút tiền của shop
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, processing, completed]
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
 *         description: Lấy danh sách lệnh rút tiền thành công
 */
router.post(
  '/shops/:shopId/withdrawals',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_WITHDRAWAL_CREATE, 'shopId'),
  validate(requestWithdrawalSchema),
  walletController.requestWithdrawal
)

router.get(
  '/shops/:shopId/withdrawals',
  authenticate,
  requireShopPermission(PERMISSIONS.SHOP_WITHDRAWAL_READ, 'shopId'),
  walletController.getWithdrawals
)

export default router
