import { jest } from '@jest/globals'

const orderModel = {
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}

const platformWalletModel = {
  findOneAndUpdate: jest.fn(),
}

const ledgerTransactionModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
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

const makePopulateChain = (value) => {
  const query = {
    populate: jest.fn(),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  }
  query.populate.mockReturnValue(query)
  return query
}

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

    orderModel.findById.mockReturnValue(makePopulateChain(paidOrder))

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

    expect(previewFee).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionType: 'SALE',
        ownerType: 'SHOP',
        baseAmount: 100000,
      })
    )
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

  it('keeps seller order net amount in clearing wallet with held settlement', async () => {
    ledgerTransactionModel.findOne.mockResolvedValueOnce(null)

    const sellerOrder = {
      _id: 'order-2',
      isActive: true,
      shop: null,
      seller: { _id: 'seller-1' },
      buyer: { _id: 'buyer-2' },
      product: { category: { _id: 'cat-2' } },
      totalAmount: 300000,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
      paymentProvider: 'wallet',
      createdAt: '2026-06-20T01:00:00.000Z',
      paidAt: '2026-06-20T01:05:00.000Z',
    }

    orderModel.findById.mockReturnValue(makePopulateChain(sellerOrder))

    previewFee.mockResolvedValue({
      feePolicyId: 'fee-2',
      transactionType: 'SALE',
      ownerType: 'SELLER',
      categoryId: 'cat-2',
      baseAmountType: 'SALE_PRICE',
      rounding: 'ROUND',
      percent: 6,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee: 18000,
      baseAmount: 300000,
      netAmount: 282000,
    })

    ledgerTransactionModel.create.mockResolvedValue([{ _id: 'ltx-2' }])
    platformWalletModel.findOneAndUpdate
      .mockResolvedValueOnce({ balance: 300000 })
      .mockResolvedValueOnce({ balance: 282000 })
      .mockResolvedValueOnce({ balance: 18000 })
    feeSnapshotModel.create.mockResolvedValue([{ _id: 'snapshot-2' }])

    const result = await ledgerService.settlePaidOrder('order-2', { source: 'wallet_payment' })

    expect(walletRepo.incrementBalance).not.toHaveBeenCalled()
    expect(walletRepo.createTransaction).not.toHaveBeenCalled()
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-2',
      expect.objectContaining({
        grossAmount: 300000,
        totalPlatformFee: 18000,
        netSettlementAmount: 282000,
        settlementStatus: 'held',
      }),
      {}
    )
    expect(result._id).toBe('ltx-2')
  })

  it('reverses shop settlement without leaving revenue balance behind', async () => {
    ledgerTransactionModel.findOne
      .mockResolvedValueOnce({
        _id: 'settlement-1',
        grossAmount: 100000,
        platformFee: 8000,
        netSettlementAmount: 92000,
      })
      .mockResolvedValueOnce(null)

    const paidOrder = {
      _id: 'order-3',
      isActive: true,
      shop: { _id: 'shop-3' },
      seller: null,
      buyer: { _id: 'buyer-3' },
      product: { category: { _id: 'cat-3' } },
      totalAmount: 100000,
      paymentStatus: 'paid',
      paymentMethod: 'payos',
      paymentProvider: 'payos',
    }

    orderModel.findById.mockReturnValue(makePopulateChain(paidOrder))
    ledgerTransactionModel.create.mockResolvedValue([{ _id: 'reversal-1' }])
    walletRepo.decrementBalance.mockResolvedValue({ _id: 'wallet-3', balance: 0 })
    platformWalletModel.findOneAndUpdate
      .mockResolvedValueOnce({ balance: 92000 })
      .mockResolvedValueOnce({ balance: 0 })
      .mockResolvedValueOnce({ balance: 100000 })

    const result = await ledgerService.reverseOrderSettlement('order-3', { source: 'refund_case', reason: 'buyer_cancelled' })

    expect(walletRepo.decrementBalance).toHaveBeenCalledWith('shop-3', 92000, {})
    expect(ledgerEntryModel.insertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          walletKey: 'platform_clearing_wallet',
          amount: 92000,
        }),
        expect.objectContaining({
          walletKey: 'platform_revenue_wallet',
          amount: 8000,
        }),
      ]),
      {}
    )
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-3',
      { settlementStatus: 'refunded' },
      {}
    )
    expect(result._id).toBe('reversal-1')
  })

  it('exports ledger with the same filters used by list view', async () => {
    const sort = jest.fn().mockReturnThis()
    const lean = jest.fn().mockResolvedValue([
      {
        _id: 'tx-1',
        transactionType: 'order_payment_settlement',
        referenceType: 'order',
        referenceId: 'order-4',
        grossAmount: 200000,
        platformFee: 10000,
        netSettlementAmount: 190000,
        settlementStatus: 'settled',
        createdAt: '2026-06-20T02:00:00.000Z',
      },
    ])

    ledgerTransactionModel.find.mockReturnValue({ sort, lean })

    const exported = await ledgerService.exportPlatformLedgerTransactions({
      transactionType: 'order_payment_settlement',
      settlementStatus: 'settled',
      orderId: 'order-4',
    })

    expect(ledgerTransactionModel.find).toHaveBeenCalledWith({
      transactionType: 'order_payment_settlement',
      settlementStatus: 'settled',
      order: 'order-4',
    })
    expect(exported.csv).toContain('order_payment_settlement')
    expect(exported.csv).toContain('settled')
    expect(exported.fileName).toContain('platform-ledger-')
  })
})
