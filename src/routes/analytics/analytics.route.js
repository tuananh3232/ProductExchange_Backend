import { Router } from 'express'
import * as optionsController from '../../controllers/options/options.controller.js'

const router = Router()

router.get('/filter-options', optionsController.getAnalyticsFilterOptions)

export default router
