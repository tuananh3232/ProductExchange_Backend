import { Router } from 'express'
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { ROLES } from '../../constants/role.constant.js'
import { resolveCaseSchema, manualRefundSchema } from '../../validations/refund/refund.validation.js'
import * as controller from '../../controllers/refund/refund.controller.js'
import { requireFeature } from '../../middlewares/feature.middleware.js'

const router = Router()
const requireKey = (req, res, next) => req.get('idempotency-key')
  ? next()
  : res.status(400).json({ success: false, message: 'Thiếu Idempotency-Key', error: 'IDEMPOTENCY_KEY_REQUIRED' })

router.use(authenticate, requireRoles(ROLES.ADMIN))
router.patch('/order-cases/:caseId/resolve', requireFeature('commerce'), validateObjectId('caseId'), requireKey, validate(resolveCaseSchema), controller.resolveCase)
router.post('/refunds/:refundId/process', requireFeature('commerce'), validateObjectId('refundId'), controller.processRefund)
router.patch('/refunds/:refundId/confirm-manual', requireFeature('commerce'), validateObjectId('refundId'), validate(manualRefundSchema), controller.confirmManual)
router.get('/reconciliation/issues', requireFeature('commerce'), controller.reconciliationIssues)
router.post('/reconciliation/run', requireFeature('commerce'), controller.runReconciliation)

export default router
