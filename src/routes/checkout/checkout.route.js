import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { createCheckoutSchema } from '../../validations/checkout/checkout.validation.js'
import * as checkoutController from '../../controllers/checkout/checkout.controller.js'

const router = Router()

router.use(authenticate)
router.post('/', (req, res, next) => req.get('idempotency-key') ? next() : res.status(400).json({ success: false, message: 'Thiếu Idempotency-Key', error: 'IDEMPOTENCY_KEY_REQUIRED' }), validate(createCheckoutSchema), checkoutController.createCheckout)
router.get('/:checkoutId', validateObjectId('checkoutId'), checkoutController.getCheckout)

export default router
