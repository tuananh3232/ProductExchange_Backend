import { Router } from 'express'
import * as comboController from '../../controllers/combo/combo.controller.js'
import * as optionsController from '../../controllers/options/options.controller.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { alternativesSchema, generateCombosSchema } from '../../validations/combo/combo.validation.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Combo Recommendation
 *     description: Personalized decor product combo suggestions
 *
 * /combos/generate:
 *   post:
 *     summary: Generate personalized product combos
 *     tags: [Combo Recommendation]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [budget]
 *             properties:
 *               style: { type: string, enum: [minimalist, modern, vintage, luxury, korean, bohemian] }
 *               roomType: { type: string, enum: [bedroom, living_room, kitchen, workspace] }
 *               colorTone: { type: string, enum: [warm, cool, neutral, dark, bright] }
 *               budget: { type: number, minimum: 1000 }
 *               maxItems: { type: integer, minimum: 2, maximum: 10, default: 5 }
 *     responses:
 *       200:
 *         description: Generated combos or an empty combo list
 *       422:
 *         description: Validation error
 *
 * /combos/alternatives:
 *   get:
 *     summary: Get alternative products for a combo item
 *     tags: [Combo Recommendation]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: decorRole
 *         required: true
 *         schema: { type: string, enum: [main_item, lighting, wall_decor, textile, accent_item, fragrance] }
 *       - in: query
 *         name: style
 *         schema: { type: string, enum: [minimalist, modern, vintage, luxury, korean, bohemian] }
 *       - in: query
 *         name: roomType
 *         schema: { type: string, enum: [bedroom, living_room, kitchen, workspace] }
 *       - in: query
 *         name: colorTone
 *         schema: { type: string, enum: [warm, cool, neutral, dark, bright] }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number, minimum: 1 }
 *       - in: query
 *         name: excludeProductIds
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Matching alternatives or an empty alternative list
 *       422:
 *         description: Validation error
 */
router.get('/options', optionsController.getComboOptions)
router.post('/generate', validate(generateCombosSchema), comboController.generateCombos)
router.get('/alternatives', validate(alternativesSchema, 'query'), comboController.getAlternatives)

export default router
