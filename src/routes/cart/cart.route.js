import { Router } from 'express'
import * as cartController from '../../controllers/cart/cart.controller.js'
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import {
  addComboSchema,
  checkoutCartSchema,
  updateCartItemSchema,
} from '../../validations/cart/cart.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: API quản lý giỏ hàng
 *
 * /cart/add-combo:
 *   post:
 *     summary: Thêm các sản phẩm combo đã tùy chỉnh vào giỏ hàng
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Đã thêm các sản phẩm combo vào giỏ hàng
 *       400:
 *         description: Một hoặc nhiều sản phẩm hiện không khả dụng
 *       401:
 *         description: Cần đăng nhập để thực hiện thao tác này
 *       422:
 *         description: Dữ liệu gửi lên không hợp lệ
 */
router.get('/', authenticate, requirePermissions(PERMISSIONS.USER_CART_READ), cartController.getCart)
router.post('/checkout', authenticate, requirePermissions(PERMISSIONS.USER_CART_CHECKOUT), validate(checkoutCartSchema), cartController.checkoutCart)
router.patch(
  '/items/:productId',
  authenticate,
  requirePermissions(PERMISSIONS.USER_CART_UPDATE),
  validateObjectId('productId'),
  validate(updateCartItemSchema),
  cartController.updateCartItem
)
router.delete(
  '/items/:productId',
  authenticate,
  requirePermissions(PERMISSIONS.USER_CART_UPDATE),
  validateObjectId('productId'),
  cartController.removeCartItem
)
router.delete('/', authenticate, requirePermissions(PERMISSIONS.USER_CART_CLEAR), cartController.clearCart)
router.post('/add-combo', authenticate, requirePermissions(PERMISSIONS.USER_CART_UPDATE), validate(addComboSchema), cartController.addCombo)

export default router
