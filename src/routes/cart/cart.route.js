import { Router } from 'express'
import * as cartController from '../../controllers/cart/cart.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { addComboSchema } from '../../validations/cart/cart.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Cart
 *     description: Shopping cart APIs
 *
 * /cart/add-combo:
 *   post:
 *     summary: Add customized combo items to cart
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
 *         description: Combo items added to cart
 *       400:
 *         description: One or more products are unavailable
 *       401:
 *         description: Authentication required
 *       422:
 *         description: Validation error
 */
router.post('/add-combo', authenticate, validate(addComboSchema), cartController.addCombo)

export default router
