import { asyncHandler } from '../../utils/async-handler.util.js'
import { sendSuccess } from '../../utils/response.util.js'
import { getPaginationParams } from '../../utils/pagination.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import MESSAGES from '../../constants/message.constant.js'
import * as feePolicyService from '../../services/fee-policy/fee-policy.service.js'

export const getFeePolicies = asyncHandler(async (req, res) => {
  const pagination = getPaginationParams(req.query)
  const { feePolicies, meta } = await feePolicyService.getFeePolicies(req.query, pagination)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.FETCHED,
    data: { feePolicies },
    meta,
  })
})

export const getFeePolicyById = asyncHandler(async (req, res) => {
  const feePolicy = await feePolicyService.getFeePolicyById(req.params.feePolicyId)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.DETAIL_FETCHED,
    data: { feePolicy },
  })
})

export const createFeePolicy = asyncHandler(async (req, res) => {
  const feePolicy = await feePolicyService.createFeePolicy(req.body, req.user?._id || null)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.CREATED,
    data: { feePolicy },
    statusCode: HTTP_STATUS.CREATED,
  })
})

export const updateFeePolicy = asyncHandler(async (req, res) => {
  const feePolicy = await feePolicyService.updateFeePolicy(req.params.feePolicyId, req.body, req.user?._id || null)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.UPDATED,
    data: { feePolicy },
  })
})

export const disableFeePolicy = asyncHandler(async (req, res) => {
  const feePolicy = await feePolicyService.disableFeePolicy(req.params.feePolicyId, req.user?._id || null)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.DISABLED,
    data: { feePolicy },
  })
})

export const previewFee = asyncHandler(async (req, res) => {
  const preview = await feePolicyService.previewFee(req.body)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.PREVIEWED,
    data: { preview },
  })
})

export const seedDefaultSaleFeePolicies = asyncHandler(async (req, res) => {
  const feePolicies = await feePolicyService.seedDefaultSaleFeePolicies(req.user?._id || null)
  sendSuccess(res, {
    message: MESSAGES.FEE_POLICY.SEEDED,
    data: { feePolicies },
    statusCode: HTTP_STATUS.CREATED,
  })
})
