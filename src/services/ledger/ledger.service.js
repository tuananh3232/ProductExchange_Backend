import Order from '../../models/order.model.js'
import Product from '../../models/product.model.js'
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
        row.createdAt,
      ].map(escapeCell).join(',')
    ),
  ].join('\n')
}

const getPlatformWallet = async (walletKey, session = null) =>
  PlatformWallet.findOneAndUpdate(
    { walletKey },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  )

const mutatePlatformWallet = async (walletKey, direction, amount, session = null) => {
  const inc = direction === LEDGER_ENTRY_DIRECTION.CREDIT
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

  const ledgerTransaction = await LedgerTransaction.create([
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
  ], session ? { session } : {})

  const tx = ledgerTransaction[0]
  const entries = []

  const clearingAfterGross = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, grossAmount, session)
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
    const clearingAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, platformFee, session)
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: platformFee,
      balanceAfter: clearingAfterFee.balance,
      counterpartyType: 'platform_revenue',
      note: 'Move platform fee out of clearing wallet',
    })

    const revenueAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.REVENUE, LEDGER_ENTRY_DIRECTION.CREDIT, platformFee, session)
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
    const clearingAfterNet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, netSettlementAmount, session)
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
    const reversalDocs = await LedgerTransaction.create([
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
    ], session ? { session } : {})

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
      const clearingAfterNet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, settlement.netSettlementAmount, session)
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
      const revenueAfterReverse = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.REVENUE, LEDGER_ENTRY_DIRECTION.DEBIT, settlement.platformFee, session)
      entries.push({
        ledgerTransaction: reversal._id,
        walletKey: PLATFORM_WALLET_KEYS.REVENUE,
        direction: LEDGER_ENTRY_DIRECTION.DEBIT,
        amount: settlement.platformFee,
        balanceAfter: revenueAfterReverse.balance,
        counterpartyType: 'platform_fee_reversal',
        note: 'Reverse platform fee revenue',
      })

      const clearingAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, settlement.platformFee, session)
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
    LedgerTransaction.countDocuments({ transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT, settlementStatus: SETTLEMENT_STATUS.SETTLED }),
    LedgerTransaction.countDocuments({ transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT, settlementStatus: SETTLEMENT_STATUS.HELD }),
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

export const getPlatformLedgerTransactions = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = {}
  if (query.transactionType) filter.transactionType = query.transactionType
  if (query.settlementStatus) filter.settlementStatus = query.settlementStatus
  if (query.orderId) filter.order = query.orderId

  const [transactions, total] = await Promise.all([
    LedgerTransaction.find(filter)
      .populate('order', 'paymentRef totalAmount paymentStatus grossAmount totalPlatformFee netSettlementAmount settlementStatus')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    LedgerTransaction.countDocuments(filter),
  ])

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

  return { transaction, entries }
}

export const exportPlatformLedgerTransactions = async (query) => {
  const rows = await LedgerTransaction.find(query.orderId ? { order: query.orderId } : {})
    .sort({ createdAt: -1 })
    .lean()

  return {
    fileName: `platform-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: 'text/csv',
    csv: buildCsv(rows),
  }
}
