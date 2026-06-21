import Order from '../../models/order.model.js'
import PlatformWallet from '../../models/platform-wallet.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import LedgerEntry from '../../models/ledger-entry.model.js'
import FeeSnapshot from '../../models/fee-snapshot.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { runMongoTransaction } from '../../utils/mongo-transaction.util.js'
import {
  LEDGER_ENTRY_DIRECTION,
  LEDGER_TRANSACTION_TYPE,
  PLATFORM_WALLET_KEYS,
} from '../../constants/ledger.constant.js'
import { PAYMENT_STATUS, SETTLEMENT_STATUS } from '../../constants/status.constant.js'
import { previewFee } from '../fee-policy/fee-policy.service.js'
import * as walletRepo from '../../repositories/wallet/wallet.repository.js'

const STUCK_SETTLEMENT_STATUSES = [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.HELD, SETTLEMENT_STATUS.DISPUTED]
const STUCK_SETTLEMENT_HOURS = 24

const buildCsv = (rows) => {
  const header = [
    'transactionId',
    'transactionType',
    'referenceType',
    'referenceId',
    'grossAmount',
    'platformFee',
    'netSettlementAmount',
    'settlementStatus',
    'reconciliationState',
    'reconciliationIssues',
    'createdAt',
  ]
  const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

  return [
    header.join(','),
    ...rows.map((row) =>
      [
        row._id,
        row.transactionType,
        row.referenceType,
        row.referenceId,
        row.grossAmount,
        row.platformFee,
        row.netSettlementAmount,
        row.settlementStatus,
        row.monitoring?.reconciliationState || 'ok',
        (row.monitoring?.reconciliationIssues || []).join('|'),
        row.createdAt,
      ].map(escapeCell).join(',')
    ),
  ].join('\n')
}

const buildLedgerFilter = (query = {}) => {
  const filter = {}

  if (query.transactionType) filter.transactionType = query.transactionType
  if (query.settlementStatus) filter.settlementStatus = query.settlementStatus
  if (query.orderId) filter.order = query.orderId

  return filter
}

const isStuckSettlement = (transaction) => {
  if (!STUCK_SETTLEMENT_STATUSES.includes(transaction.settlementStatus)) {
    return false
  }

  const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : null
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return false
  }

  return Date.now() - createdAt.getTime() >= STUCK_SETTLEMENT_HOURS * 60 * 60 * 1000
}

const buildMonitoringForTransaction = (transaction, entries = []) => {
  const reconciliationIssues = []

  if (!entries.length) {
    reconciliationIssues.push('missing_entries')
  }

  if (!entries.some((entry) => entry.walletKey === PLATFORM_WALLET_KEYS.CLEARING)) {
    reconciliationIssues.push('missing_clearing_entry')
  }

  if (transaction.platformFee > 0 && !entries.some((entry) => entry.walletKey === PLATFORM_WALLET_KEYS.REVENUE)) {
    reconciliationIssues.push('missing_revenue_entry')
  }

  if (isStuckSettlement(transaction)) {
    reconciliationIssues.push('stuck_settlement')
  }

  return {
    reconciliationState: reconciliationIssues.length ? 'issue' : 'ok',
    reconciliationIssues,
    isStuckSettlement: reconciliationIssues.includes('stuck_settlement'),
    entryCount: entries.length,
  }
}

const enrichLedgerTransactionsWithMonitoring = async (transactions) => {
  if (!transactions.length) {
    return []
  }

  const ledgerTransactionIds = transactions.map((transaction) => transaction._id)
  const entries = await LedgerEntry.find({ ledgerTransaction: { $in: ledgerTransactionIds } }).lean()
  const entriesByTransactionId = new Map()

  for (const entry of entries) {
    const key = String(entry.ledgerTransaction)
    const current = entriesByTransactionId.get(key) || []
    current.push(entry)
    entriesByTransactionId.set(key, current)
  }

  return transactions.map((transaction) => {
    const transactionEntries = entriesByTransactionId.get(String(transaction._id)) || []
    return {
      ...transaction,
      monitoring: buildMonitoringForTransaction(transaction, transactionEntries),
    }
  })
}

const applyMonitoringFilter = (transactions, query = {}) => {
  if (!query.reconciliationState || query.reconciliationState === 'all') {
    return transactions
  }

  if (query.reconciliationState === 'issue') {
    return transactions.filter((transaction) => transaction.monitoring?.reconciliationState === 'issue')
  }

  if (query.reconciliationState === 'stuck') {
    return transactions.filter((transaction) => transaction.monitoring?.isStuckSettlement)
  }

  return transactions
}

const getPlatformWallet = async (walletKey, session = null) =>
  PlatformWallet.findOneAndUpdate(
    { walletKey },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  )

const mutatePlatformWallet = async (walletKey, direction, amount, session = null) => {
  const inc =
    direction === LEDGER_ENTRY_DIRECTION.CREDIT
      ? { balance: amount, totalIn: amount }
      : { balance: -amount, totalOut: amount }

  return PlatformWallet.findOneAndUpdate(
    { walletKey },
    { $inc: inc },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  )
}

const resolveFallbackFeePreview = (baseAmount, ownerType) => {
  const percent = ownerType === 'SHOP' ? 5 : 5
  const calculatedFee = Math.round((Number(baseAmount) * percent) / 100)

  return {
    feePolicyId: null,
    transactionType: 'SALE',
    ownerType,
    categoryId: null,
    baseAmountType: 'SALE_PRICE',
    rounding: 'ROUND',
    percent,
    fixedFee: 0,
    minFee: 0,
    maxFee: null,
    calculatedFee,
    baseAmount: Number(baseAmount),
    netAmount: Number(baseAmount) - calculatedFee,
    explanation: 'Fallback SALE fee preview',
  }
}

const resolveOrderForSettlement = async (orderId) => {
  const order = await Order.findById(orderId)
    .populate('buyer', 'name email')
    .populate('shop', 'name slug owner')
    .populate('seller', 'name email')
    .populate({
      path: 'product',
      populate: { path: 'category', select: 'name slug' },
      select: 'title category ownerType shop seller',
    })

  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  return order
}

const buildFeeSnapshotPayload = (order, preview) => ({
  sourceType: 'order',
  sourceId: order._id,
  feePolicyId: preview.feePolicyId || null,
  transactionType: preview.transactionType,
  ownerType: preview.ownerType,
  categoryId: preview.categoryId || order.product?.category?._id || order.product?.category || null,
  baseAmountType: preview.baseAmountType,
  rounding: preview.rounding,
  baseAmount: preview.baseAmount,
  percent: preview.percent,
  fixedFee: preview.fixedFee || 0,
  minFee: preview.minFee || 0,
  maxFee: preview.maxFee ?? null,
  calculatedFee: preview.calculatedFee,
  netAmount: preview.netAmount,
  effectiveFrom: order.paidAt || new Date(),
  effectiveTo: null,
  lockedAt: new Date(),
})

const loadFeePreviewForOrder = async (order) => {
  const ownerType = order.shop ? 'SHOP' : 'SELLER'
  const categoryId = order.product?.category?._id || order.product?.category || null

  try {
    return await previewFee({
      transactionType: 'SALE',
      ownerType,
      categoryId,
      baseAmount: Number(order.totalAmount),
      transactionCreatedAt: order.paidAt || order.createdAt || new Date(),
    })
  } catch {
    return resolveFallbackFeePreview(order.totalAmount, ownerType)
  }
}

const createLedgerTransactionDetails = async ({
  transactionType,
  order,
  preview,
  source,
  session,
}) => {
  const grossAmount = Math.round(Number(order.totalAmount))
  const platformFee = Math.round(Number(preview.calculatedFee))
  const netSettlementAmount = Math.max(0, grossAmount - platformFee)
  const canSettleToShopWallet = Boolean(order.shop)
  const settlementStatus = canSettleToShopWallet ? SETTLEMENT_STATUS.SETTLED : SETTLEMENT_STATUS.HELD

  const ledgerTransaction = await LedgerTransaction.create(
    [
      {
        transactionType,
        referenceType: 'order',
        referenceId: order._id,
        order: order._id,
        grossAmount,
        platformFee,
        netSettlementAmount,
        settlementStatus,
        source,
        description: `Ledger posting for order ${order._id}`,
        metadata: {
          paymentMethod: order.paymentMethod,
          paymentProvider: order.paymentProvider,
          shopId: order.shop?._id || order.shop || null,
          sellerId: order.seller?._id || order.seller || null,
        },
      },
    ],
    session ? { session } : {}
  )

  const tx = ledgerTransaction[0]
  const entries = []

  const clearingAfterGross = await mutatePlatformWallet(
    PLATFORM_WALLET_KEYS.CLEARING,
    LEDGER_ENTRY_DIRECTION.CREDIT,
    grossAmount,
    session
  )
  entries.push({
    ledgerTransaction: tx._id,
    walletKey: PLATFORM_WALLET_KEYS.CLEARING,
    direction: LEDGER_ENTRY_DIRECTION.CREDIT,
    amount: grossAmount,
    balanceAfter: clearingAfterGross.balance,
    counterpartyType: 'buyer_payment',
    counterpartyId: order.buyer?._id || order.buyer || null,
    note: 'Gross payment captured into platform clearing wallet',
  })

  if (platformFee > 0) {
    const clearingAfterFee = await mutatePlatformWallet(
      PLATFORM_WALLET_KEYS.CLEARING,
      LEDGER_ENTRY_DIRECTION.DEBIT,
      platformFee,
      session
    )
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: platformFee,
      balanceAfter: clearingAfterFee.balance,
      counterpartyType: 'platform_revenue',
      note: 'Move platform fee out of clearing wallet',
    })

    const revenueAfterFee = await mutatePlatformWallet(
      PLATFORM_WALLET_KEYS.REVENUE,
      LEDGER_ENTRY_DIRECTION.CREDIT,
      platformFee,
      session
    )
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.REVENUE,
      direction: LEDGER_ENTRY_DIRECTION.CREDIT,
      amount: platformFee,
      balanceAfter: revenueAfterFee.balance,
      counterpartyType: 'platform_fee',
      note: 'Recognize platform fee revenue',
    })
  }

  if (canSettleToShopWallet && netSettlementAmount > 0) {
    const clearingAfterNet = await mutatePlatformWallet(
      PLATFORM_WALLET_KEYS.CLEARING,
      LEDGER_ENTRY_DIRECTION.DEBIT,
      netSettlementAmount,
      session
    )
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: netSettlementAmount,
      balanceAfter: clearingAfterNet.balance,
      counterpartyType: 'shop_wallet',
      counterpartyId: order.shop?._id || order.shop,
      note: 'Release seller/shop net settlement from clearing wallet',
    })

    const wallet = await walletRepo.incrementBalance(order.shop?._id || order.shop, netSettlementAmount, session ? { session } : {})
    await walletRepo.createTransaction(
      {
        wallet: wallet._id,
        shop: order.shop?._id || order.shop,
        order: order._id,
        type: 'credit',
        grossAmount,
        platformFee,
        netAmount: netSettlementAmount,
        description: `Nhận tiền ròng đơn hàng #${order._id}`,
        metadata: {
          orderId: order._id,
          ledgerTransactionId: tx._id,
        },
      },
      session ? { session } : {}
    )
  }

  await LedgerEntry.insertMany(entries, session ? { session } : {})

  const feeSnapshotDocs = await FeeSnapshot.create([buildFeeSnapshotPayload(order, preview)], session ? { session } : {})
  const feeSnapshot = feeSnapshotDocs[0]

  await Order.findByIdAndUpdate(
    order._id,
    {
      grossAmount,
      totalPlatformFee: platformFee,
      netSettlementAmount,
      settlementStatus,
      feeSnapshotId: feeSnapshot._id,
      feePolicyId: preview.feePolicyId || null,
    },
    session ? { session } : {}
  )

  return tx
}

export const settlePaidOrder = async (orderId, { source = 'payment_callback' } = {}) => {
  const existing = await LedgerTransaction.findOne({
    referenceType: 'order',
    referenceId: orderId,
    transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
  })

  if (existing) {
    return existing
  }

  const order = await resolveOrderForSettlement(orderId)
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng chưa ở trạng thái đã thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.PAYMENT_REQUIRED)
  }

  const preview = await loadFeePreviewForOrder(order)

  return runMongoTransaction(async (session) =>
    createLedgerTransactionDetails({
      transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
      order,
      preview,
      source,
      session,
    })
  )
}

export const reverseOrderSettlement = async (orderId, { source = 'refund_flow', reason = '' } = {}) => {
  const settlement = await LedgerTransaction.findOne({
    referenceType: 'order',
    referenceId: orderId,
    transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
  })

  if (!settlement) {
    return null
  }

  const existing = await LedgerTransaction.findOne({
    referenceType: 'order',
    referenceId: orderId,
    transactionType: LEDGER_TRANSACTION_TYPE.REFUND_REVERSAL,
  })
  if (existing) {
    return existing
  }

  const order = await resolveOrderForSettlement(orderId)

  return runMongoTransaction(async (session) => {
    const reversalDocs = await LedgerTransaction.create(
      [
        {
          transactionType: LEDGER_TRANSACTION_TYPE.REFUND_REVERSAL,
          referenceType: 'order',
          referenceId: order._id,
          order: order._id,
          grossAmount: settlement.grossAmount,
          platformFee: settlement.platformFee,
          netSettlementAmount: settlement.netSettlementAmount,
          settlementStatus: SETTLEMENT_STATUS.REFUNDED,
          source,
          description: `Refund reversal for order ${order._id}`,
          metadata: {
            reason,
            reverseLedgerTransactionId: settlement._id,
          },
        },
      ],
      session ? { session } : {}
    )

    const reversal = reversalDocs[0]
    const entries = []

    if (settlement.netSettlementAmount > 0 && order.shop) {
      const updatedWallet = await walletRepo.decrementBalance(order.shop?._id || order.shop, settlement.netSettlementAmount, session ? { session } : {})
      if (!updatedWallet) {
        throw new AppError(
          'Số dư ví shop không đủ để đảo bút toán hoàn tiền',
          HTTP_STATUS.BAD_REQUEST,
          ERRORS.WALLET.INSUFFICIENT_BALANCE
        )
      }

      const clearingAfterNet = await mutatePlatformWallet(
        PLATFORM_WALLET_KEYS.CLEARING,
        LEDGER_ENTRY_DIRECTION.CREDIT,
        settlement.netSettlementAmount,
        session
      )
      entries.push({
        ledgerTransaction: reversal._id,
        walletKey: PLATFORM_WALLET_KEYS.CLEARING,
        direction: LEDGER_ENTRY_DIRECTION.CREDIT,
        amount: settlement.netSettlementAmount,
        balanceAfter: clearingAfterNet.balance,
        counterpartyType: 'shop_wallet_reversal',
        counterpartyId: order.shop?._id || order.shop,
        note: 'Return net settlement into clearing wallet',
      })
    }

    if (settlement.platformFee > 0) {
      const revenueAfterReverse = await mutatePlatformWallet(
        PLATFORM_WALLET_KEYS.REVENUE,
        LEDGER_ENTRY_DIRECTION.DEBIT,
        settlement.platformFee,
        session
      )
      entries.push({
        ledgerTransaction: reversal._id,
        walletKey: PLATFORM_WALLET_KEYS.REVENUE,
        direction: LEDGER_ENTRY_DIRECTION.DEBIT,
        amount: settlement.platformFee,
        balanceAfter: revenueAfterReverse.balance,
        counterpartyType: 'platform_fee_reversal',
        note: 'Reverse platform fee revenue',
      })

      const clearingAfterFee = await mutatePlatformWallet(
        PLATFORM_WALLET_KEYS.CLEARING,
        LEDGER_ENTRY_DIRECTION.CREDIT,
        settlement.platformFee,
        session
      )
      entries.push({
        ledgerTransaction: reversal._id,
        walletKey: PLATFORM_WALLET_KEYS.CLEARING,
        direction: LEDGER_ENTRY_DIRECTION.CREDIT,
        amount: settlement.platformFee,
        balanceAfter: clearingAfterFee.balance,
        counterpartyType: 'refund_reserve',
        note: 'Restore fee amount into clearing wallet',
      })
    }

    if (entries.length) {
      await LedgerEntry.insertMany(entries, session ? { session } : {})
    }

    await Order.findByIdAndUpdate(
      order._id,
      { settlementStatus: SETTLEMENT_STATUS.REFUNDED },
      session ? { session } : {}
    )

    return reversal
  })
}

export const getPlatformWalletSummary = async () => {
  const [clearingWallet, revenueWallet, settledCount, heldCount] = await Promise.all([
    getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING),
    getPlatformWallet(PLATFORM_WALLET_KEYS.REVENUE),
    LedgerTransaction.countDocuments({
      transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
    }),
    LedgerTransaction.countDocuments({
      transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
      settlementStatus: SETTLEMENT_STATUS.HELD,
    }),
  ])

  return {
    clearingWallet,
    revenueWallet,
    totals: {
      settledTransactions: settledCount,
      heldTransactions: heldCount,
    },
  }
}

export const getPlatformLedgerReconciliationSummary = async () => {
  const [clearingWallet, revenueWallet, clearingEntries, revenueEntries, stuckTransactions, missingEntryTransactions] = await Promise.all([
    getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING),
    getPlatformWallet(PLATFORM_WALLET_KEYS.REVENUE),
    LedgerEntry.aggregate([
      { $match: { walletKey: PLATFORM_WALLET_KEYS.CLEARING } },
      {
        $group: {
          _id: null,
          expectedBalance: {
            $sum: {
              $cond: [{ $eq: ['$direction', LEDGER_ENTRY_DIRECTION.CREDIT] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]),
    LedgerEntry.aggregate([
      { $match: { walletKey: PLATFORM_WALLET_KEYS.REVENUE } },
      {
        $group: {
          _id: null,
          expectedBalance: {
            $sum: {
              $cond: [{ $eq: ['$direction', LEDGER_ENTRY_DIRECTION.CREDIT] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]),
    LedgerTransaction.find({ settlementStatus: { $in: STUCK_SETTLEMENT_STATUSES } })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean(),
    LedgerTransaction.aggregate([
      {
        $lookup: {
          from: 'ledgerentries',
          localField: '_id',
          foreignField: 'ledgerTransaction',
          as: 'entries',
        },
      },
      { $match: { entries: { $size: 0 } } },
      { $count: 'count' },
    ]),
  ])

  const expectedClearingBalance = clearingEntries[0]?.expectedBalance || 0
  const expectedRevenueBalance = revenueEntries[0]?.expectedBalance || 0
  const clearingDrift = Number(clearingWallet.balance || 0) - Number(expectedClearingBalance)
  const revenueDrift = Number(revenueWallet.balance || 0) - Number(expectedRevenueBalance)
  const stuckItems = stuckTransactions.filter(isStuckSettlement)

  return {
    walletDrift: {
      clearing: {
        actualBalance: clearingWallet.balance || 0,
        expectedBalance: expectedClearingBalance,
        driftAmount: clearingDrift,
        hasDrift: clearingDrift !== 0,
      },
      revenue: {
        actualBalance: revenueWallet.balance || 0,
        expectedBalance: expectedRevenueBalance,
        driftAmount: revenueDrift,
        hasDrift: revenueDrift !== 0,
      },
    },
    issueCounts: {
      missingEntryTransactions: missingEntryTransactions[0]?.count || 0,
      stuckSettlements: stuckItems.length,
      walletDriftIssues: [clearingDrift !== 0, revenueDrift !== 0].filter(Boolean).length,
    },
    stuckTransactions: stuckItems.map((transaction) => ({
      _id: transaction._id,
      transactionType: transaction.transactionType,
      settlementStatus: transaction.settlementStatus,
      createdAt: transaction.createdAt,
      referenceType: transaction.referenceType,
      referenceId: transaction.referenceId,
      monitoring: buildMonitoringForTransaction(transaction, []),
    })),
  }
}

export const getPlatformLedgerTransactions = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = buildLedgerFilter(query)
  const baseTransactions = await LedgerTransaction.find(filter)
    .populate('order', 'paymentRef totalAmount paymentStatus grossAmount totalPlatformFee netSettlementAmount settlementStatus')
    .sort({ [sortBy]: sortOrder })
    .lean()

  const monitoredTransactions = applyMonitoringFilter(await enrichLedgerTransactionsWithMonitoring(baseTransactions), query)
  const transactions = monitoredTransactions.slice(skip, skip + limit)
  const total = monitoredTransactions.length

  return {
    transactions,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getPlatformLedgerTransactionById = async (transactionId) => {
  const transaction = await LedgerTransaction.findById(transactionId)
    .populate('order', 'paymentRef totalAmount paymentStatus grossAmount totalPlatformFee netSettlementAmount settlementStatus')
    .lean()

  if (!transaction) {
    throw new AppError('Không tìm thấy platform ledger transaction', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND)
  }

  const entries = await LedgerEntry.find({ ledgerTransaction: transactionId }).sort({ createdAt: 1 }).lean()
  return {
    transaction: {
      ...transaction,
      monitoring: buildMonitoringForTransaction(transaction, entries),
    },
    entries,
  }
}

export const exportPlatformLedgerTransactions = async (query) => {
  const rows = await LedgerTransaction.find(buildLedgerFilter(query))
    .sort({ createdAt: -1 })
    .lean()
  const monitoredRows = applyMonitoringFilter(await enrichLedgerTransactionsWithMonitoring(rows), query)

  return {
    fileName: `platform-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: 'text/csv',
    csv: buildCsv(monitoredRows),
  }
}
