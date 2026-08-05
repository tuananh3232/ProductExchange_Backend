import Order from '../../models/order.model.js'
import PlatformWallet from '../../models/platform-wallet.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import LedgerEntry from '../../models/ledger-entry.model.js'
import FeeSnapshot from '../../models/fee-snapshot.model.js'
import SubscriptionOrder from '../../models/subscription-order.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { runMongoTransaction } from '../../utils/mongo-transaction.util.js'
import {
  LEDGER_ENTRY_DIRECTION,
  LEDGER_REFERENCE_TYPE,
  LEDGER_TRANSACTION_TYPE,
  PLATFORM_WALLET_KEYS,
} from '../../constants/ledger.constant.js'
import { ORDER_STATUS, PAYMENT_STATUS, SETTLEMENT_STATUS } from '../../constants/status.constant.js'
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
    'source',
    'description',
    'paymentMethod',
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
        row.source,
        row.description,
        row.metadata?.paymentMethod,
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

  const isVipRevenue = transaction.transactionType === LEDGER_TRANSACTION_TYPE.VIP_SUBSCRIPTION_PAYMENT

  if (!isVipRevenue && !entries.some((entry) => entry.walletKey === PLATFORM_WALLET_KEYS.CLEARING)) {
    reconciliationIssues.push('missing_clearing_entry')
  }

  if ((transaction.platformFee > 0 || isVipRevenue) && !entries.some((entry) => entry.walletKey === PLATFORM_WALLET_KEYS.REVENUE)) {
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

const getOrphanLedgerEntrySummary = async () => {
  const [summary = {}] = await LedgerEntry.aggregate([
    {
      $lookup: {
        from: 'ledgertransactions',
        localField: 'ledgerTransaction',
        foreignField: '_id',
        as: 'transaction',
      },
    },
    { $match: { transaction: { $size: 0 } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        clearingAmount: {
          $sum: {
            $cond: [
              { $eq: ['$walletKey', PLATFORM_WALLET_KEYS.CLEARING] },
              { $cond: [{ $eq: ['$direction', LEDGER_ENTRY_DIRECTION.CREDIT] }, '$amount', { $multiply: ['$amount', -1] }] },
              0,
            ],
          },
        },
        revenueAmount: {
          $sum: {
            $cond: [
              { $eq: ['$walletKey', PLATFORM_WALLET_KEYS.REVENUE] },
              { $cond: [{ $eq: ['$direction', LEDGER_ENTRY_DIRECTION.CREDIT] }, '$amount', { $multiply: ['$amount', -1] }] },
              0,
            ],
          },
        },
      },
    },
  ])

  return {
    count: summary.count || 0,
    clearingAmount: summary.clearingAmount || 0,
    revenueAmount: summary.revenueAmount || 0,
  }
}

const getMissingOrderSettlementCount = async () => {
  const [summary = {}] = await Order.aggregate([
    { $match: { paymentStatus: PAYMENT_STATUS.PAID, status: { $ne: ORDER_STATUS.CANCELLED } } },
    {
      $lookup: {
        from: 'ledgertransactions',
        let: { orderId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$order', '$$orderId'] },
                  { $eq: ['$transactionType', LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT] },
                ],
              },
            },
          },
        ],
        as: 'settlements',
      },
    },
    { $match: { settlements: { $size: 0 } } },
    { $count: 'count' },
  ])

  return summary.count || 0
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

const recordUserWalletPlatformFlow = async ({
  transactionType,
  referenceType,
  referenceId,
  userId,
  amount,
  source,
  description,
  direction,
  session = null,
}) => {
  const filter = { referenceType, referenceId, transactionType }
  const existing = session
    ? await LedgerTransaction.findOne(filter).session(session).lean()
    : await LedgerTransaction.findOne(filter).lean()
  if (existing) return existing

  if (direction === LEDGER_ENTRY_DIRECTION.DEBIT) {
    const clearingWallet = await getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, session)
    if (Number(clearingWallet.balance) < Number(amount)) {
      throw new AppError('Số dư ví trung gian không đủ để thực hiện giao dịch', HTTP_STATUS.BAD_REQUEST, ERRORS.WALLET.INSUFFICIENT_BALANCE)
    }
  }

  const options = session ? { session } : {}
  const [transaction] = await LedgerTransaction.create([
    {
      transactionType,
      referenceType,
      referenceId,
      grossAmount: amount,
      platformFee: 0,
      netSettlementAmount: amount,
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
      source,
      description,
      metadata: { userId, walletFlow: true },
    },
  ], options)

  const wallet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, direction, amount, session)
  await LedgerEntry.create([
    {
      ledgerTransaction: transaction._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction,
      amount,
      balanceAfter: wallet.balance,
      counterpartyType: 'user_wallet',
      counterpartyId: userId,
      note: description,
      metadata: { source },
    },
  ], options)

  return transaction
}

export const recordUserWalletTopup = async ({
  referenceId,
  userId,
  amount,
  source = 'user_wallet_topup',
  description = 'Nạp tiền vào ví người dùng',
  referenceType = LEDGER_REFERENCE_TYPE.USER_WALLET_TOPUP,
  session = null,
}) => recordUserWalletPlatformFlow({
  transactionType: LEDGER_TRANSACTION_TYPE.USER_WALLET_TOPUP,
  referenceType,
  referenceId,
  userId,
  amount,
  source,
  description,
  direction: LEDGER_ENTRY_DIRECTION.CREDIT,
  session,
})

export const recordUserWalletWithdrawal = async ({ referenceId, userId, amount, source = 'user_wallet_withdrawal', session = null }) =>
  recordUserWalletPlatformFlow({
    transactionType: LEDGER_TRANSACTION_TYPE.USER_WALLET_WITHDRAWAL,
    referenceType: LEDGER_REFERENCE_TYPE.USER_WALLET,
    referenceId,
    userId,
    amount,
    source,
    description: 'Chi tiền từ ví trung gian cho người dùng',
    direction: LEDGER_ENTRY_DIRECTION.DEBIT,
    session,
  })

/**
 * Ghi nhận doanh thu bán gói VIP vào ví doanh thu nền tảng.
 * Mỗi subscription order chỉ được ghi nhận một lần nhờ khóa duy nhất
 * (referenceType + referenceId + transactionType), kể cả khi callback lặp.
 */
export const recordVipSubscriptionRevenue = async (subscriptionOrderId, { paymentMethod = 'payos' } = {}) => {
  const subscription = await SubscriptionOrder.findById(subscriptionOrderId).lean()
  if (!subscription || subscription.status !== 'completed') return null

  const filter = {
    referenceType: LEDGER_REFERENCE_TYPE.SUBSCRIPTION_ORDER,
    referenceId: subscription._id,
    transactionType: LEDGER_TRANSACTION_TYPE.VIP_SUBSCRIPTION_PAYMENT,
  }
  const existing = await LedgerTransaction.findOne(filter).lean()
  if (existing) return existing

  try {
    return await runMongoTransaction(async (session) => {
      const existingInTransaction = session
        ? await LedgerTransaction.findOne(filter).session(session).lean()
        : await LedgerTransaction.findOne(filter).lean()
      if (existingInTransaction) return existingInTransaction

      const options = session ? { session } : {}
      const [transaction] = await LedgerTransaction.create(
        [
          {
            transactionType: LEDGER_TRANSACTION_TYPE.VIP_SUBSCRIPTION_PAYMENT,
            referenceType: LEDGER_REFERENCE_TYPE.SUBSCRIPTION_ORDER,
            referenceId: subscription._id,
            subscriptionOrder: subscription._id,
            grossAmount: subscription.amount,
            platformFee: 0,
            netSettlementAmount: subscription.amount,
            settlementStatus: SETTLEMENT_STATUS.SETTLED,
            source: `vip_subscription_${paymentMethod}`,
            description: `Doanh thu gói VIP ${subscription.plan === 'monthly' ? '1 tháng' : '1 năm'}`,
            metadata: {
              subscriptionOrderId: subscription._id,
              userId: subscription.user,
              plan: subscription.plan,
              paymentMethod,
              revenueCategory: 'vip_subscription',
            },
          },
        ],
        options
      )

      const revenueWallet = await mutatePlatformWallet(
        PLATFORM_WALLET_KEYS.REVENUE,
        LEDGER_ENTRY_DIRECTION.CREDIT,
        subscription.amount,
        session
      )

      await LedgerEntry.create(
        [
          {
            ledgerTransaction: transaction._id,
            walletKey: PLATFORM_WALLET_KEYS.REVENUE,
            direction: LEDGER_ENTRY_DIRECTION.CREDIT,
            amount: subscription.amount,
            balanceAfter: revenueWallet.balance,
            counterpartyType: 'vip_subscription',
            counterpartyId: subscription.user,
            note: `Ghi nhận doanh thu gói VIP (${paymentMethod === 'wallet' ? 'thanh toán từ ví' : 'thanh toán trực tiếp'})`,
            metadata: { subscriptionOrderId: subscription._id, plan: subscription.plan, paymentMethod },
          },
        ],
        options
      )

      return transaction
    })
  } catch (error) {
    if (error?.code === 11000) return LedgerTransaction.findOne(filter).lean()
    throw error
  }
}

const resolveFallbackFeePreview = (baseAmount, ownerType) => {
  const percent = ownerType === 'SHOP' ? 10 : 10
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
  releaseSettlement = false,
}) => {
  const grossAmount = Math.round(Number(order.totalAmount))
  const platformFee = Math.round(Number(preview.calculatedFee))
  const netSettlementAmount = Math.max(0, grossAmount - platformFee)
  const canSettleToShopWallet = Boolean(order.shop)
  const isUserWalletPayment = order.paymentMethod === 'wallet' || order.paymentProvider === 'wallet'
  const settlementStatus = releaseSettlement && canSettleToShopWallet ? SETTLEMENT_STATUS.SETTLED : SETTLEMENT_STATUS.HELD

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

  if (isUserWalletPayment) {
    const clearingWallet = await getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, session)
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.CREDIT,
      amount: 0,
      balanceAfter: clearingWallet.balance,
      counterpartyType: 'user_wallet_payment',
      counterpartyId: order.buyer?._id || order.buyer || null,
      note: 'Thanh toán từ ví người dùng; ví trung gian không thay đổi',
    })
  } else {
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
  }

  if (releaseSettlement && platformFee > 0) {
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

  if (releaseSettlement && canSettleToShopWallet && netSettlementAmount > 0) {
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

export const recognizeOrderRevenue = async (orderId, { source = 'buyer_confirmed_received' } = {}) => {
  const settlement = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.ORDER,
    referenceId: orderId,
    transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
  })
  if (!settlement || settlement.revenueRecognizedAt) return settlement

  const order = await resolveOrderForSettlement(orderId)
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new AppError('Chỉ ghi nhận doanh thu khi người mua đã xác nhận nhận hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }

  return runMongoTransaction(async (session) => {
    const options = session ? { session } : {}
    const feeAmount = Number(settlement.platformFee || 0)
    const entries = []
    if (!settlement.revenueRecognizedAt && feeAmount > 0) {
      const clearingAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, feeAmount, session)
      const revenueAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.REVENUE, LEDGER_ENTRY_DIRECTION.CREDIT, feeAmount, session)
      entries.push(
        {
          ledgerTransaction: settlement._id,
          walletKey: PLATFORM_WALLET_KEYS.CLEARING,
          direction: LEDGER_ENTRY_DIRECTION.DEBIT,
          amount: feeAmount,
          balanceAfter: clearingAfterFee.balance,
          counterpartyType: 'platform_revenue',
          note: 'Trích hoa hồng vào ví doanh thu sau khi người mua xác nhận nhận hàng',
        },
        {
          ledgerTransaction: settlement._id,
          walletKey: PLATFORM_WALLET_KEYS.REVENUE,
          direction: LEDGER_ENTRY_DIRECTION.CREDIT,
          amount: feeAmount,
          balanceAfter: revenueAfterFee.balance,
          counterpartyType: 'platform_fee',
          note: 'Ghi nhận hoa hồng là doanh thu cuối của nền tảng',
        }
      )
    }
    if (entries.length) await LedgerEntry.insertMany(entries, options)

    const recognizedAt = new Date()
    await LedgerTransaction.findByIdAndUpdate(settlement._id, {
      revenueRecognizedAt: recognizedAt,
      shopSettlementReleaseAt: order.shopSettlementReleaseAt || new Date(recognizedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      source,
    }, options)
    return LedgerTransaction.findById(settlement._id, null, options)
  })
}

export const releaseOrderSettlement = async (orderId, { source = 'shop_settlement_release' } = {}) => {
  let settlement = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.ORDER,
    referenceId: orderId,
    transactionType: LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT,
  })
  if (!settlement || settlement.settlementStatus === SETTLEMENT_STATUS.SETTLED) return settlement

  const order = await resolveOrderForSettlement(orderId)
  if (order.status !== ORDER_STATUS.COMPLETED) {
    throw new AppError('Chỉ được quyết toán khi người mua đã xác nhận nhận hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.ORDER.INVALID_STATUS_TRANSITION)
  }
  if (!order.shop) return settlement
  if (!settlement.revenueRecognizedAt) {
    settlement = await recognizeOrderRevenue(orderId)
    if (!settlement) return null
  }
  const releaseAt = settlement.shopSettlementReleaseAt || order.shopSettlementReleaseAt
  if (releaseAt && new Date(releaseAt) > new Date()) return settlement

  return runMongoTransaction(async (session) => {
    const options = session ? { session } : {}
    const entries = []
    const feeAmount = Number(settlement.platformFee || 0)
    const netAmount = Number(settlement.netSettlementAmount || 0)

    if (netAmount > 0) {
      const clearingAfterNet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, netAmount, session)
      const wallet = await walletRepo.incrementBalance(order.shop._id || order.shop, netAmount, options)
      await walletRepo.createTransaction(
        {
          wallet: wallet._id,
          shop: order.shop._id || order.shop,
          order: order._id,
          type: 'credit',
          grossAmount: settlement.grossAmount,
          platformFee: feeAmount,
          netAmount,
          description: `Nhận tiền ròng đơn hàng #${order._id}`,
          metadata: { orderId: order._id, ledgerTransactionId: settlement._id, source },
        },
        options
      )
      entries.push({
        ledgerTransaction: settlement._id,
        walletKey: PLATFORM_WALLET_KEYS.CLEARING,
        direction: LEDGER_ENTRY_DIRECTION.DEBIT,
        amount: netAmount,
        balanceAfter: clearingAfterNet.balance,
        counterpartyType: 'shop_wallet',
        counterpartyId: order.shop._id || order.shop,
        note: 'Giải ngân tiền thực nhận cho shop sau khi giao hàng hoàn tất',
      })
    }

    if (entries.length) await LedgerEntry.insertMany(entries, options)
    const shopSettledAt = new Date()
    await LedgerTransaction.findByIdAndUpdate(settlement._id, {
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
      shopSettledAt,
      source,
    }, options)
    await Order.findByIdAndUpdate(order._id, {
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
      shopSettledAt,
    }, options)
    return LedgerTransaction.findById(settlement._id, null, options)
  })
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

    if (settlement.settlementStatus === SETTLEMENT_STATUS.HELD) {
      const isUserWalletPayment = order.paymentMethod === 'wallet' || order.paymentProvider === 'wallet' || settlement.metadata?.paymentMethod === 'wallet'
      if (isUserWalletPayment) {
        const clearingWallet = await getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, session)
        entries.push({
          ledgerTransaction: reversal._id,
          walletKey: PLATFORM_WALLET_KEYS.CLEARING,
          direction: LEDGER_ENTRY_DIRECTION.DEBIT,
          amount: 0,
          balanceAfter: clearingWallet.balance,
          counterpartyType: 'user_wallet_refund',
          counterpartyId: order.buyer?._id || order.buyer,
          note: 'Hoàn tiền về ví người dùng; ví trung gian không thay đổi',
        })
      } else {
        const clearingAfterRefund = await mutatePlatformWallet(
          PLATFORM_WALLET_KEYS.CLEARING,
          LEDGER_ENTRY_DIRECTION.DEBIT,
          settlement.grossAmount,
          session
        )
        entries.push({
          ledgerTransaction: reversal._id,
          walletKey: PLATFORM_WALLET_KEYS.CLEARING,
          direction: LEDGER_ENTRY_DIRECTION.DEBIT,
          amount: settlement.grossAmount,
          balanceAfter: clearingAfterRefund.balance,
          counterpartyType: 'refund_destination',
          counterpartyId: order.buyer?._id || order.buyer,
          note: 'Hoàn phần tiền đang giữ trước khi đơn hàng được giao',
        })
      }

      await LedgerEntry.insertMany(entries, session ? { session } : {})
      await Order.findByIdAndUpdate(
        order._id,
        { settlementStatus: SETTLEMENT_STATUS.REFUNDED },
        session ? { session } : {}
      )
      return reversal
    }

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
  const [clearingWallet, revenueWallet, settledCount, heldCount, vipSummary] = await Promise.all([
    getPlatformWallet(PLATFORM_WALLET_KEYS.CLEARING),
    getPlatformWallet(PLATFORM_WALLET_KEYS.REVENUE),
    LedgerTransaction.countDocuments({
      transactionType: { $in: [LEDGER_TRANSACTION_TYPE.ORDER_PAYMENT_SETTLEMENT, LEDGER_TRANSACTION_TYPE.VIP_SUBSCRIPTION_PAYMENT] },
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
    }),
    LedgerTransaction.countDocuments({
      settlementStatus: { $in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.HELD, SETTLEMENT_STATUS.DISPUTED] },
    }),
    SubscriptionOrder.aggregate([
      {
        $match: {
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  return {
    clearingWallet,
    revenueWallet,
    totals: {
      settledTransactions: settledCount,
      heldTransactions: heldCount,
      vipRevenue: vipSummary[0]?.amount || 0,
      vipPurchases: vipSummary[0]?.count || 0,
    },
  }
}

export const getPlatformLedgerReconciliationSummary = async () => {
  const [
    clearingWallet,
    revenueWallet,
    clearingEntries,
    revenueEntries,
    stuckTransactions,
    missingEntryTransactions,
    orphanEntries,
    missingOrderSettlements,
  ] = await Promise.all([
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
    getOrphanLedgerEntrySummary(),
    getMissingOrderSettlementCount(),
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
      missingOrderSettlements,
      orphanLedgerEntries: orphanEntries.count,
      stuckSettlements: stuckItems.length,
      walletDriftIssues: [clearingDrift !== 0, revenueDrift !== 0].filter(Boolean).length,
    },
    orphanEntries,
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
    .populate('subscriptionOrder', 'plan amount paymentMethod status paidAt user')
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
    .populate('subscriptionOrder', 'plan amount paymentMethod status paidAt user')
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
