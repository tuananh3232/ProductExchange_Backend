import { Router } from 'express'
import * as feePolicyController from '../../controllers/fee-policy/fee-policy.controller.js'

const router = Router()

router.get('/', feePolicyController.getPublicFeePolicies)

export default router
