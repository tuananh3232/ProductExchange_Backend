import { Router } from 'express'
import * as platformController from '../../controllers/platform/platform.controller.js'

const router = Router()
router.get('/capabilities', platformController.getCapabilities)
export default router
