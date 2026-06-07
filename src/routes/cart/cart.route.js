import { Router } from 'express'
import * as cartController from '../../controllers/cart/cart.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import {
  addCartItemSchema,
  addComboSchema,
  cartProductParamSchema,
  updateCartItemSchema,
} from '../../validations/cart/cart.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: API quan ly gio hang
 *
 * /cart:
 *   get:
 *     summary: Lay gio hang cua nguoi dung dang dang nhap
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lay gio hang thanh cong
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *   delete:
 *     summary: Xoa toan bo gio hang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Xoa gio hang thanh cong
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *
 * /cart/items:
 *   post:
 *     summary: Them san pham vao gio hang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: string }
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Them san pham vao gio hang thanh cong
 *       400:
 *         description: San pham khong con duoc ban hoac khong du ton kho
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *       404:
 *         description: Khong tim thay san pham
 *       422:
 *         description: Du lieu dau vao khong hop le
 *
 * /cart/items/{productId}:
 *   patch:
 *     summary: Cap nhat so luong san pham trong gio hang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Cap nhat gio hang thanh cong
 *       400:
 *         description: San pham khong con duoc ban hoac khong du ton kho
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *       404:
 *         description: San pham khong ton tai trong gio hang
 *       422:
 *         description: Du lieu dau vao khong hop le
 *   delete:
 *     summary: Xoa san pham khoi gio hang
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xoa san pham khoi gio hang thanh cong
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *       404:
 *         description: San pham khong ton tai trong gio hang
 *       422:
 *         description: Du lieu dau vao khong hop le
 *
 * /cart/add-combo:
 *   post:
 *     summary: Them cac san pham trong combo tuy chinh vao gio hang
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
 *         description: Them cac san pham trong combo vao gio hang thanh cong
 *       400:
 *         description: Mot hoac nhieu san pham khong con kha dung
 *       401:
 *         description: Chua dang nhap hoac phien dang nhap khong hop le
 *       422:
 *         description: Du lieu dau vao khong hop le
 */
router.get('/', authenticate, cartController.getMyCart)
router.post('/items', authenticate, validate(addCartItemSchema), cartController.addItem)
router.patch(
  '/items/:productId',
  authenticate,
  validate(cartProductParamSchema, 'params'),
  validate(updateCartItemSchema),
  cartController.updateItem
)
router.delete(
  '/items/:productId',
  authenticate,
  validate(cartProductParamSchema, 'params'),
  cartController.removeItem
)
router.delete('/', authenticate, cartController.clearCart)
router.post('/add-combo', authenticate, validate(addComboSchema), cartController.addCombo)

export default router
