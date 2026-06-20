import { jest } from '@jest/globals'

const orderModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}

const platformWalletModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}

const ledgerTransactionModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}

const ledgerEntryModel = {
  insertMany: jest.fn(),
  find: jest.fn(),
}

const feeSnapshotModel = {
  create: jest.fn(),
}

const walletRepo = {
  incrementBalance: jest.fn(),
  createTransaction: jest.fn(),
  decrementBalance: jest.fn(),
}

const previewFee = jest.fn()

jest.unstable_mockModule('../../src/models/order.model.js', () => ({ default: orderModel }))
jest.unstable_mockModule('../../src/models/product.model.js', () => ({ default: {} }))
jest.unstable_mockModule('../../src/models/platform-wallet.model.js', () => ({ default: platformWalletModel }))
jest.unstable_mockModule('../../src/models/ledger-transaction.model.js', () => ({ default: ledgerTransactionModel }))
jest.unstable_mockModule('../../src/models/ledger-entry.model.js', () => ({ default: ledgerEntryModel }))
jest.unstable_mockModule('../../src/models/fee-snapshot.model.js', () => ({ default: feeSnapshotModel }))
jest.unstable_mockModule('../../src/services/fee-policy/fee-policy.service.js', () => ({ previewFee }))
jest.unstable_mockModule('../../src/repositories/wallet/wallet.repository.js', () => walletRepo)
jest.unstable_mockModule('../../src/utils/mongo-transaction.util.js', () => ({
  runMongoTransaction: async (operation) => operation(null),
}))

const ledgerService = await import('../../src/services/ledger/ledger.service.js')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ledger service unit', () => {
  it('posts clearing, fee, and shop settlement when order is paid', async () => {
    ledgerTransactionModel.findOne.mockResolvedValueOnce(null)

    const paidOrder = {
      _id: 'order-1',
      isActive: true,
      shop: { _id: 'shop-1', name: 'Decor Shop' },
      seller: null,
      buyer: { _id: 'buyer-1' },
      product: { category: { _id: 'cat-1' } },
      totalAmount: 100000,
      paymentStatus: 'paid',
      paymentMethod: 'payos',
      paymentProvider: 'payos',
      createdAt: '2026-06-20T00:00:00.000Z',
      paidAt: '2026-06-20T00:05:00.000Z',
    }

    const orderQuery = {
      populate: jest.fn(),
      then: (resolve, reject) => Promise.resolve(paidOrder).then(resolve, reject),
    }
    orderQuery.populate.mockReturnValue(orderQuery)
    orderModel.findById.mockReturnValue(orderQuery)

    previewFee.mockResolvedValue({
      feePolicyId: 'fee-1',
      transactionType: 'SALE',
      ownerType: 'SHOP',
      categoryId: 'cat-1',
      baseAmountType: 'SALE_PRICE',
      rounding: 'ROUND',
      percent: 8,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee: 8000,
      baseAmount: 100000,
      netAmount: 92000,
    })

    ledgerTransactionModel.create.mockResolvedValue([{ _id: 'ltx-1' }])
    platformWalletModel.findOneAndUpdate
      .mockResolvedValueOnce({ balance: 100000 })
      .mockResolvedValueOnce({ balance: 92000 })
      .mockResolvedValueOnce({ balance: 8000 })
      .mockResolvedValueOnce({ balance: 0 })
    walletRepo.incrementBalance.mockResolvedValue({ _id: 'wallet-1' })
    walletRepo.createTransaction.mockResolvedValue({ _id: 'wtx-1' })
    feeSnapshotModel.create.mockResolvedValue([{ _id: 'snapshot-1' }])

    const result = await ledgerService.settlePaidOrder('order-1', { source: 'unit_test' })

    expect(previewFee).toHaveBeenCalledWith(expect.objectContaining({
      transactionType: 'SALE',
      ownerType: 'SHOP',
      baseAmount: 100000,
    }))
    expect(walletRepo.incrementBalance).toHaveBeenCalledWith('shop-1', 92000, {})
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        grossAmount: 100000,
        totalPlatformFee: 8000,
        netSettlementAmount: 92000,
        settlementStatus: 'settled',
      }),
      {}
    )
    expect(result._id).toBe('ltx-1')
  })
})
