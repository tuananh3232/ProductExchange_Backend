import { Router } from 'express'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import * as statsController from '../../controllers/stats/stats.controller.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Statistics
 *   description: API thống kê cho admin và shop owner
 *
 * /admin/stats/overview:
 *   get:
 *     summary: Thống kê tổng quan toàn hệ thống (admin)
 *     tags: [Statistics]
 *     parameters:
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
 *         description: Lấy thống kê tổng quan thành công
 *
 * /admin/stats/revenue:
 *   get:
 *     summary: Thống kê doanh thu toàn hệ thống (admin)
 *     tags: [Statistics]
 *     parameters:
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
 *         description: Lấy thống kê doanh thu thành công
 *
 * /admin/stats/top-shops:
 *   get:
 *     summary: Top shop theo doanh thu (admin)
 *     tags: [Statistics]
 *     parameters:
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Lấy top shop thành công
 *
 * /admin/stats/top-products:
 *   get:
 *     summary: Top sản phẩm theo doanh thu (admin)
 *     tags: [Statistics]
 *     parameters:
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Lấy top sản phẩm thành công
 */

router.get('/overview', authenticate, requirePermissions(PERMISSIONS.ADMIN_VIEW_STATS), statsController.adminOverview)
router.get('/revenue', authenticate, requirePermissions(PERMISSIONS.ADMIN_VIEW_STATS), statsController.adminRevenue)
router.get('/top-shops', authenticate, requirePermissions(PERMISSIONS.ADMIN_VIEW_STATS), statsController.adminTopShops)
router.get('/top-products', authenticate, requirePermissions(PERMISSIONS.ADMIN_VIEW_STATS), statsController.adminTopProducts)

export default router