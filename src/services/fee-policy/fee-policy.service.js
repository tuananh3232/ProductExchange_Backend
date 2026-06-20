import mongoose from 'mongoose'
import FeePolicy from '../../models/fee-policy.model.js'
import FeeSnapshot from '../../models/fee-snapshot.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import { FEE_OWNER_TYPE } from '../../constants/fee.constant.js'
import { FEE_POLICY_STATUS } from '../../constants/status.constant.js'

const sortPoliciesBySpecificity = (policies = []) =>
  [...policies].sort((left, right) => {
    const leftCategoryScore = left.categoryId ? 1 : 0
    const rightCategoryScore = right.categoryId ? 1 : 0
    if (leftCategoryScore !== rightCategoryScore) {
      return rightCategoryScore - leftCategoryScore
    }

    const leftOwnerScore = left.ownerType === FEE_OWNER_TYPE.ALL ? 0 : 1
    const rightOwnerScore = right.ownerType === FEE_OWNER_TYPE.ALL ? 0 : 1
    if (leftOwnerScore !== rightOwnerScore) {
      return rightOwnerScore - leftOwnerScore
    }

    const leftRangeScore = (left.minAmount !== null ? 1 : 0) + (left.maxAmount !== null ? 1 : 0)
    const rightRangeScore = (right.minAmount !== null ? 1 : 0) + (right.maxAmount !== null ? 1 : 0)
    if (leftRangeScore !== rightRangeScore) {
      return rightRangeScore - leftRangeScore
    }

    return new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime()
  })

const matchesAmountRange = (policy, amount) => {
  if (policy.minAmount !== null && amount < policy.minAmount) return false
  if (policy.maxAmount !== null && amount >= policy.maxAmount) return false
  return true
}

const matchesEffectiveTime = (policy, transactionCreatedAt) => {
  const effectiveAt = new Date(transactionCreatedAt)
  if (Number.isNaN(effectiveAt.getTime())) return false
  if (effectiveAt < new Date(policy.effectiveFrom)) return false
  if (policy.effectiveTo && effectiveAt > new Date(policy.effectiveTo)) return false
  return true
}

const matchesOwnerType = (policy, ownerType) =>
  policy.ownerType === FEE_OWNER_TYPE.ALL || policy.ownerType === ownerType

const matchesCategory = (policy, categoryId) => {
  if (!policy.categoryId) return true
  if (!categoryId) return false
  return String(policy.categoryId) === String(categoryId)
}

export const normalizeFeePreview = (policy, baseAmount) => {
  let calculatedFee = (Number(baseAmount) * Number(policy.percent || 0)) / 100 + Number(policy.fixedFee || 0)

  if (policy.minFee !== null && policy.minFee !== undefined) {
    calculatedFee = Math.max(calculatedFee, Number(policy.minFee))
  }

  if (policy.maxFee !== null && policy.maxFee !== undefined) {
    calculatedFee = Math.min(calculatedFee, Number(policy.maxFee))
  }

  if (policy.rounding === 'FLOOR') {
    calculatedFee = Math.floor(calculatedFee)
  } else if (policy.rounding === 'CEIL') {
    calculatedFee = Math.ceil(calculatedFee)
  } else {
    calculatedFee = Math.round(calculatedFee)
  }

  return {
    baseAmount: Number(baseAmount),
    calculatedFee,
    netAmount: Math.max(0, Number(baseAmount) - calculatedFee),
  }
}

export const selectApplicablePolicy = (policies, criteria) => {
  const matches = policies.filter((policy) =>
    policy.status === FEE_POLICY_STATUS.ACTIVE &&
    policy.transactionType === criteria.transactionType &&
    matchesOwnerType(policy, criteria.ownerType) &&
    matchesCategory(policy, criteria.categoryId) &&
    matchesAmountRange(policy, criteria.baseAmount) &&
    matchesEffectiveTime(policy, criteria.transactionCreatedAt)
  )

  return sortPoliciesBySpecificity(matches)[0] || null
}

export const previewFeeFromPolicies = (policies, criteria) => {
  const policy = selectApplicablePolicy(policies, criteria)

  if (!policy) {
    throw new AppError('Không tìm thấy fee policy phù hợp', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const totals = normalizeFeePreview(policy, criteria.baseAmount)

  return {
    policy,
    preview: {
      feePolicyId: policy._id,
      transactionType: policy.transactionType,
      ownerType: policy.ownerType,
      baseAmountType: policy.baseAmountType,
      rounding: policy.rounding,
      percent: policy.percent,
      fixedFee: policy.fixedFee,
      minFee: policy.minFee,
      maxFee: policy.maxFee,
      explanation: `Applied ${policy.percent}% fee policy for ${policy.transactionType}`,
      ...totals,
    },
  }
}

const assertNoRangeConflict = async ({ payload, ignoreId = null }) => {
  const query = {
    transactionType: payload.transactionType,
    ownerType: payload.ownerType,
    status: payload.status,
    effectiveFrom: { $lte: payload.effectiveTo ? new Date(payload.effectiveTo) : new Date('2999-12-31T23:59:59.999Z') },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: new Date(payload.effectiveFrom) } },
    ],
  }

  if (payload.categoryId) {
    query.categoryId = payload.categoryId
  } else {
    query.categoryId = null
  }

  if (ignoreId) {
    query._id = { $ne: ignoreId }
  }

  const candidates = await FeePolicy.find(query).lean()
  const hasConflict = candidates.some((policy) => {
    const leftMin = payload.minAmount ?? 0
    const leftMax = payload.maxAmount ?? Number.POSITIVE_INFINITY
    const rightMin = policy.minAmount ?? 0
    const rightMax = policy.maxAmount ?? Number.POSITIVE_INFINITY
    return leftMin < rightMax && rightMin < leftMax
  })

  if (hasConflict) {
    throw new AppError('Fee policy bị chồng khoảng tiền hoặc thời gian hiệu lực', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.DUPLICATE)
  }
}

const buildFeePolicyPayload = (payload, adminId, { isUpdate = false } = {}) => ({
  transactionType: payload.transactionType,
  ownerType: payload.ownerType,
  categoryId: payload.categoryId || null,
  minAmount: payload.minAmount ?? null,
  maxAmount: payload.maxAmount ?? null,
  percent: payload.percent,
  minFee: payload.minFee ?? 0,
  maxFee: payload.maxFee ?? null,
  fixedFee: payload.fixedFee ?? 0,
  baseAmountType: payload.baseAmountType,
  rounding: payload.rounding,
  status: payload.status,
  effectiveFrom: new Date(payload.effectiveFrom),
  effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
  ...(isUpdate ? { updatedByAdminId: adminId } : { createdByAdminId: adminId, updatedByAdminId: adminId }),
})

export const getFeePolicies = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = {}

  if (query.status) filter.status = query.status
  if (query.transactionType) filter.transactionType = query.transactionType
  if (query.ownerType) filter.ownerType = query.ownerType
  if (query.categoryId) filter.categoryId = query.categoryId

  const [feePolicies, total] = await Promise.all([
    FeePolicy.find(filter)
      .populate('categoryId', 'name slug')
      .populate('createdByAdminId', 'name email')
      .populate('updatedByAdminId', 'name email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    FeePolicy.countDocuments(filter),
  ])

  return {
    feePolicies,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getFeePolicyById = async (feePolicyId) => {
  const feePolicy = await FeePolicy.findById(feePolicyId)
    .populate('categoryId', 'name slug')
    .populate('createdByAdminId', 'name email')
    .populate('updatedByAdminId', 'name email')

  if (!feePolicy) {
    throw new AppError('Không tìm thấy fee policy', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  return feePolicy
}

export const createFeePolicy = async (payload, adminId) => {
  await assertNoRangeConflict({ payload })

  const feePolicy = await FeePolicy.create(buildFeePolicyPayload(payload, adminId))

  await writeAuditLog({
    adminId,
    action: 'FEE_POLICY_CREATED',
    targetType: 'fee_policy',
    targetId: feePolicy._id,
    newStatus: feePolicy.status,
    metadata: {
      transactionType: feePolicy.transactionType,
      ownerType: feePolicy.ownerType,
      minAmount: feePolicy.minAmount,
      maxAmount: feePolicy.maxAmount,
      percent: feePolicy.percent,
    },
  })

  return getFeePolicyById(feePolicy._id)
}

export const updateFeePolicy = async (feePolicyId, payload, adminId) => {
  const feePolicy = await FeePolicy.findById(feePolicyId)
  if (!feePolicy) {
    throw new AppError('Không tìm thấy fee policy', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const snapshotCount = await FeeSnapshot.countDocuments({ feePolicyId })
  if (feePolicy.status === FEE_POLICY_STATUS.ACTIVE && snapshotCount > 0) {
    throw new AppError(
      'Fee policy active đã có giao dịch sử dụng, hãy tạo policy version mới thay vì sửa trực tiếp',
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.VALIDATION.INVALID_FORMAT
    )
  }

  await assertNoRangeConflict({ payload, ignoreId: feePolicyId })

  const nextPayload = buildFeePolicyPayload(payload, adminId, { isUpdate: true })
  const updated = await FeePolicy.findByIdAndUpdate(feePolicyId, nextPayload, { new: true, runValidators: true })

  await writeAuditLog({
    adminId,
    action: 'FEE_POLICY_UPDATED',
    targetType: 'fee_policy',
    targetId: feePolicyId,
    previousStatus: feePolicy.status,
    newStatus: updated.status,
    metadata: {
      previousPercent: feePolicy.percent,
      nextPercent: updated.percent,
      previousEffectiveFrom: feePolicy.effectiveFrom,
      nextEffectiveFrom: updated.effectiveFrom,
    },
  })

  return getFeePolicyById(feePolicyId)
}

export const disableFeePolicy = async (feePolicyId, adminId) => {
  const feePolicy = await FeePolicy.findById(feePolicyId)
  if (!feePolicy) {
    throw new AppError('Không tìm thấy fee policy', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const updated = await FeePolicy.findByIdAndUpdate(
    feePolicyId,
    {
      status: FEE_POLICY_STATUS.INACTIVE,
      updatedByAdminId: adminId,
      disabledAt: new Date(),
    },
    { new: true }
  )

  await writeAuditLog({
    adminId,
    action: 'FEE_POLICY_DISABLED',
    targetType: 'fee_policy',
    targetId: feePolicyId,
    previousStatus: feePolicy.status,
    newStatus: updated.status,
  })

  return getFeePolicyById(feePolicyId)
}

export const previewFee = async (payload) => {
  const policies = await FeePolicy.find({
    transactionType: payload.transactionType,
    status: FEE_POLICY_STATUS.ACTIVE,
  }).lean()

  return previewFeeFromPolicies(policies, {
    transactionType: payload.transactionType,
    ownerType: payload.ownerType,
    categoryId: payload.categoryId || null,
    baseAmount: payload.baseAmount,
    transactionCreatedAt: payload.transactionCreatedAt || new Date().toISOString(),
  }).preview
}

export const seedDefaultSaleFeePolicies = async (adminId = null) => {
  const defaults = [
    { minAmount: 0, maxAmount: 100000, percent: 5 },
    { minAmount: 100000, maxAmount: 1000000, percent: 8 },
    { minAmount: 1000000, maxAmount: 5000000, percent: 10 },
    { minAmount: 5000000, maxAmount: null, percent: 12 },
  ]

  const session = await mongoose.startSession()
  try {
    session.startTransaction()
    await FeePolicy.deleteMany({ transactionType: 'SALE', ownerType: 'ALL', categoryId: null }, { session })

    const created = await FeePolicy.insertMany(
      defaults.map((item) => ({
        transactionType: 'SALE',
        ownerType: 'ALL',
        categoryId: null,
        minAmount: item.minAmount,
        maxAmount: item.maxAmount,
        percent: item.percent,
        minFee: 0,
        maxFee: null,
        fixedFee: 0,
        baseAmountType: 'SALE_PRICE',
        rounding: 'ROUND',
        status: FEE_POLICY_STATUS.ACTIVE,
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        effectiveTo: null,
        createdByAdminId: adminId,
        updatedByAdminId: adminId,
      })),
      { session }
    )

    await session.commitTransaction()
    return created
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}
