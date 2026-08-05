import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import MESSAGES from '../../constants/message.constant.js'
import * as feePolicyService from '../../services/fee-policy/fee-policy.service.js'

export const getPublicFeePolicies = asyncHandler(async (req, res) => {
  const feePolicies = await feePolicyService.getPublicActiveFeePolicies()
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.FETCHED,
    data: { feePolicies },
  })
})
