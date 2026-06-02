import * as comboService from '../../services/combo/combo.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'

export const generateCombos = asyncHandler(async (req, res) => {
  const combos = await comboService.generateCombos(req.body)
  sendSuccess(res, {
    message: combos.length ? MESSAGES.COMBO.GENERATED : MESSAGES.COMBO.NO_PRODUCTS,
    data: { combos },
  })
})

export const getAlternatives = asyncHandler(async (req, res) => {
  const alternatives = await comboService.getAlternatives(req.query)
  sendSuccess(res, {
    message: alternatives.length ? MESSAGES.COMBO.ALTERNATIVES_FETCHED : MESSAGES.COMBO.NO_ALTERNATIVES,
    data: { alternatives },
  })
})
