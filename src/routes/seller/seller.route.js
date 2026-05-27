import { Router } from 'express'
import * as productController from '../../controllers/product/product.controller.js'
import { authenticate, authorize } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { productQuerySchema } from '../../validations/common/query.validation.js'
import { ROLES } from '../../constants/role.constant.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Seller Products
 *     description: API xem danh sách sản phẩm cá nhân của seller
 *
 * /seller/products:
 *   get:
 *     summary: Lấy danh sách sản phẩm cá nhân
 *     tags: [Seller Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [available, hidden, pending, sold] }
 *       - in: query
 *         name: condition
 *         schema: { type: string, enum: [new, like_new, good, fair, poor] }
 *     responses:
 *       200:
 *         description: Lấy danh sách sản phẩm cá nhân thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Cần quyền seller
 */
router.get('/products', authenticate, authorize(ROLES.SELLER), validate(productQuerySchema, 'query'), productController.getSellerProducts)

export default router
