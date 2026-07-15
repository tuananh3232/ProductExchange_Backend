import { Router } from 'express'
import { authenticate, requireRoles } from '../../middlewares/auth.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { validateObjectId } from '../../middlewares/object-id.middleware.js'
import { ROLES } from '../../constants/role.constant.js'
import {
  resolveCaseSchema,
  manualRefundSchema,
  listOrderCasesSchema,
  listRefundsSchema,
  listPaymentAttemptsSchema,
} from '../../validations/refund/refund.validation.js'
import * as controller from '../../controllers/refund/refund.controller.js'
import { requireFeature } from '../../middlewares/feature.middleware.js'

const router = Router()
const requireKey = (req, res, next) => req.get('idempotency-key')
  ? next()
  : res.status(400).json({ success: false, message: 'Thiếu Idempotency-Key', error: 'IDEMPOTENCY_KEY_REQUIRED' })

router.use(authenticate, requireRoles(ROLES.ADMIN))
router.get('/order-cases', requireFeature('commerce'), validate(listOrderCasesSchema, 'query'), controller.listOrderCases)
router.get('/order-cases/:caseId', requireFeature('commerce'), validateObjectId('caseId'), controller.getOrderCase)
router.patch('/order-cases/:caseId/resolve', requireFeature('commerce'), validateObjectId('caseId'), requireKey, validate(resolveCaseSchema), controller.resolveCase)
router.get('/refunds', requireFeature('commerce'), validate(listRefundsSchema, 'query'), controller.listRefunds)
router.get('/refunds/:refundId', requireFeature('commerce'), validateObjectId('refundId'), controller.getRefund)
router.post('/refunds/:refundId/process', requireFeature('commerce'), validateObjectId('refundId'), controller.processRefund)
router.patch('/refunds/:refundId/confirm-manual', requireFeature('commerce'), validateObjectId('refundId'), validate(manualRefundSchema), controller.confirmManual)
router.get('/payment-attempts', requireFeature('commerce'), validate(listPaymentAttemptsSchema, 'query'), controller.listPaymentAttempts)
router.get('/payment-attempts/:paymentId', requireFeature('commerce'), validateObjectId('paymentId'), controller.getPaymentAttempt)
router.get('/reconciliation/issues', requireFeature('commerce'), controller.reconciliationIssues)
router.post('/reconciliation/run', requireFeature('commerce'), controller.runReconciliation)

export default router
