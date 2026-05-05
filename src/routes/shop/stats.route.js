import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import * as statsController from '../../controllers/stats/stats.controller.js'

const router = Router({ mergeParams: true })

/**
 * @swagger
 * /shops/{id}/stats/overview:
 *   get:
 *     summary: Thống kê tổng quan của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: DD/MM/YYYY
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: DD/MM/YYYY
 *     responses:
 *       200:
 *         description: Lấy thống kê tổng quan shop thành công
 *
 * /shops/{id}/stats/revenue:
 *   get:
 *     summary: Thống kê doanh thu của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: DD/MM/YYYY
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *           example: DD/MM/YYYY
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, month]
 *     responses:
 *       200:
 *         description: Lấy thống kê doanh thu shop thành công
 *
 * /shops/{id}/stats/products:
 *   get:
 *     summary: Thống kê sản phẩm của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thống kê sản phẩm shop thành công
 *
 * /shops/{id}/stats/orders:
 *   get:
 *     summary: Thống kê đơn hàng của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thống kê đơn hàng shop thành công
 *
 * /shops/{id}/stats/staff:
 *   get:
 *     summary: Thống kê nhân sự của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thống kê nhân sự shop thành công
 *
 * /shops/{id}/stats/deliveries:
 *   get:
 *     summary: Thống kê giao hàng của shop
 *     tags: [Statistics]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy thống kê giao hàng shop thành công
 */

router.get('/overview', authenticate, statsController.shopOverview)
router.get('/products', authenticate, statsController.shopProducts)
router.get('/orders', authenticate, statsController.shopOrders)
router.get('/staff', authenticate, statsController.shopStaff)

export default router