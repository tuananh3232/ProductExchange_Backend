import * as cartService from '../../services/cart/cart.service.js'
import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

export const addCombo = asyncHandler(async (req, res) => {
  const result = await cartService.addCombo(req.user._id, req.body.items)
  if (result.errors) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.CART.SOME_PRODUCTS_UNAVAILABLE,
      errors: result.errors,
    })
  }
  return sendSuccess(res, { message: MESSAGES.CART.COMBO_ADDED, data: { cart: result.cart } })
})
