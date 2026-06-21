import { jest } from '@jest/globals'

const feePolicyModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn(),
}

const feeSnapshotModel = {
  countDocuments: jest.fn(),
}

const writeAuditLog = jest.fn()

jest.unstable_mockModule('../../src/models/fee-policy.model.js', () => ({ default: feePolicyModel }))
jest.unstable_mockModule('../../src/models/fee-snapshot.model.js', () => ({ default: feeSnapshotModel }))
jest.unstable_mockModule('../../src/services/audit/audit-log.service.js', () => ({ writeAuditLog }))
jest.unstable_mockModule('mongoose', () => ({
  default: {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  },
}))

const feePolicyService = await import('../../src/services/fee-policy/fee-policy.service.js')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fee policy service unit', () => {
  it('calculates 80,000 sale fee at 5%', () => {
    const result = feePolicyService.previewFeeFromPolicies(
      [
        {
          _id: 'policy-1',
          transactionType: 'SALE',
          ownerType: 'ALL',
          categoryId: null,
          minAmount: 0,
          maxAmount: 100000,
          percent: 5,
          fixedFee: 0,
          minFee: 0,
          maxFee: null,
          rounding: 'ROUND',
          baseAmountType: 'SALE_PRICE',
          status: 'active',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
        },
      ],
      {
        transactionType: 'SALE',
        ownerType: 'ALL',
        categoryId: null,
        baseAmount: 80000,
        transactionCreatedAt: '2026-06-20T00:00:00.000Z',
      }
    )

    expect(result.preview.calculatedFee).toBe(4000)
    expect(result.preview.netAmount).toBe(76000)
  })

  it('calculates 100,000 sale fee at 8%', () => {
    const result = feePolicyService.previewFeeFromPolicies(
      [
        {
          _id: 'policy-2',
          transactionType: 'SALE',
          ownerType: 'ALL',
          categoryId: null,
          minAmount: 100000,
          maxAmount: 1000000,
          percent: 8,
          fixedFee: 0,
          minFee: 0,
          maxFee: null,
          rounding: 'ROUND',
          baseAmountType: 'SALE_PRICE',
          status: 'active',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
        },
      ],
      {
        transactionType: 'SALE',
        ownerType: 'ALL',
        categoryId: null,
        baseAmount: 100000,
        transactionCreatedAt: '2026-06-20T00:00:00.000Z',
      }
    )

    expect(result.preview.calculatedFee).toBe(8000)
  })

  it('calculates 2,000,000 sale fee at 10%', () => {
    const result = feePolicyService.previewFeeFromPolicies(
      [
        {
          _id: 'policy-3',
          transactionType: 'SALE',
          ownerType: 'ALL',
          categoryId: null,
          minAmount: 1000000,
          maxAmount: 5000000,
          percent: 10,
          fixedFee: 0,
          minFee: 0,
          maxFee: null,
          rounding: 'ROUND',
          baseAmountType: 'SALE_PRICE',
          status: 'active',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
        },
      ],
      {
        transactionType: 'SALE',
        ownerType: 'ALL',
        categoryId: null,
        baseAmount: 2000000,
        transactionCreatedAt: '2026-06-20T00:00:00.000Z',
      }
    )

    expect(result.preview.calculatedFee).toBe(200000)
  })

  it('creates audit log when fee policy is created', async () => {
    feePolicyModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    })
    feePolicyModel.create.mockResolvedValue({ _id: 'policy-4' })
    const feePolicyDoc = {
      _id: 'policy-4',
      status: 'draft',
    }
    const query = {
      populate: jest.fn(),
      then: (resolve, reject) => Promise.resolve(feePolicyDoc).then(resolve, reject),
    }
    query.populate.mockReturnValue(query)
    feePolicyModel.findById.mockReturnValue(query)

    await feePolicyService.createFeePolicy(
      {
        transactionType: 'SALE',
        ownerType: 'ALL',
        categoryId: null,
        minAmount: 0,
        maxAmount: 100000,
        percent: 5,
        minFee: 0,
        maxFee: null,
        fixedFee: 0,
        baseAmountType: 'SALE_PRICE',
        rounding: 'ROUND',
        status: 'draft',
        effectiveFrom: '2026-06-20T00:00:00.000Z',
        effectiveTo: null,
      },
      'admin-1'
    )

    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'FEE_POLICY_CREATED',
      targetType: 'fee_policy',
      adminId: 'admin-1',
    }))
  })
})
