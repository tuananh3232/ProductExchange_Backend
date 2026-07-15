import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { requireFeature } from '../../middlewares/feature.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { createPaymentAttemptSchema } from '../../validations/payment/payment-attempt.validation.js'
import * as controller from '../../controllers/payment/payment-attempt.controller.js'

const router = Router()
const requireIdempotencyKey = (req, res, next) => req.get('idempotency-key')
  ? next()
  : res.status(400).json({ success: false, message: 'Thiếu Idempotency-Key', error: 'IDEMPOTENCY_KEY_REQUIRED' })

router.post('/payos/webhook', requireFeature('payosPayments'), controller.payosWebhook)
router.get('/payos/return', requireFeature('payosPayments'), controller.payosReturn)
router.get('/payos/cancel', requireFeature('payosPayments'), controller.payosReturn)
router.post('/', authenticate, requireIdempotencyKey, validate(createPaymentAttemptSchema), controller.create)
router.get('/:paymentId', authenticate, validateObjectId('paymentId'), controller.detail)

export default router
