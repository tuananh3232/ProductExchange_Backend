import { Router } from 'express'
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js'
import { ROLES } from '../../constants/role.constant.js'
import * as statsController from '../../controllers/stats/stats.controller.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { adminStatsQuerySchema } from '../../validations/admin/admin.validation.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const router = Router()
const requireAdmin = requireRoles(ROLES.ADMIN)

/**
 * @swagger
 * tags:
 *   - name: Admin Statistics
 *     description: API thống kê toàn hệ thống dành cho admin
 *
 * /admin/stats/overview:
 *   get:
 *     summary: Thống kê tổng quan toàn hệ thống
 *     tags: [Admin Statistics]
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
 *     summary: Thống kê doanh thu toàn hệ thống
 *     tags: [Admin Statistics]
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
 *     summary: Top shop theo doanh thu
 *     tags: [Admin Statistics]
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
 *     summary: Top sản phẩm theo doanh thu
 *     tags: [Admin Statistics]
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

const validateStatsQuery = validate(adminStatsQuerySchema, 'query', HTTP_STATUS.BAD_REQUEST)

router.get('/overview', authenticate, requireAdmin, validateStatsQuery, statsController.adminOverview)
router.get('/revenue', authenticate, requireAdmin, validateStatsQuery, statsController.adminRevenue)
router.get('/top-shops', authenticate, requireAdmin, validateStatsQuery, statsController.adminTopShops)
router.get('/top-products', authenticate, requireAdmin, validateStatsQuery, statsController.adminTopProducts)

export default router
