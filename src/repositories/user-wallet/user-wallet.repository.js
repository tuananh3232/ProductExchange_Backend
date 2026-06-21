import UserWallet from '../../models/user-wallet.model.js'
import UserWalletTransaction from '../../models/user-wallet-transaction.model.js'
import UserWalletTopup from '../../models/user-wallet-topup.model.js'
import UserWalletWithdrawal from '../../models/user-wallet-withdrawal.model.js'
import { TOPUP_STATUS, WITHDRAWAL_STATUS } from '../../constants/status.constant.js'

// ─── Wallet ──────────────────────────────────────────────────────────────────

export const findByUser = (userId, options = {}) =>
  UserWallet.findOne({ user: userId }, null, options)

export const findOrCreateByUser = (userId) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    {},
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

export const creditTopup = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount, totalTopUp: amount } },
    { returnDocument: 'after', upsert: true }
  )

export const creditExchangeSettlement = (userId, amount, options = {}) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount } },
    { returnDocument: 'after', upsert: true, ...options }
  )

export const deductForOrder = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount, totalSpent: amount } },
    { returnDocument: 'after' }
  )

export const deductForExchange = (userId, amount, options = {}) =>
  UserWallet.findOneAndUpdate(
    { user: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount, totalSpent: amount } },
    { returnDocument: 'after', ...options }
  )

export const refundFromOrder = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount, totalSpent: -amount } },
    { returnDocument: 'after', upsert: true }
  )

export const refundFromExchange = (userId, amount, options = {}) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount, totalSpent: -amount } },
    { returnDocument: 'after', upsert: true, ...options }
  )

// atomic deduct: chỉ thành công khi balance >= amount
export const deductForWithdrawal = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount, pendingBalance: amount } },
    { returnDocument: 'after' }
  )

// hoàn tiền khi withdrawal bị reject
export const revertWithdrawal = (userId, amount, options = {}) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount, pendingBalance: -amount } },
    { returnDocument: 'after', ...options }
  )

// finalize khi withdrawal hoàn tất
export const completeWithdrawal = (userId, amount, options = {}) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { pendingBalance: -amount, totalWithdrawn: amount } },
    { returnDocument: 'after', ...options }
  )

// ─── Transactions ─────────────────────────────────────────────────────────────

export const createTransaction = (data, options = {}) =>
  UserWalletTransaction.create([data], options).then((docs) => docs[0])

export const findTransactions = ({ filter, skip, limit, sortBy = 'createdAt', sortOrder = 'desc' }) =>
  UserWalletTransaction.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)
    .populate('order', 'totalAmount status')
    .populate('topup', 'amount status transactionRef')

export const countTransactions = (filter) => UserWalletTransaction.countDocuments(filter)

export const findTransactionByOrder = (orderId) =>
  UserWalletTransaction.findOne({ order: orderId, type: 'payment' })

export const findRefundTransactionByOrder = (orderId) =>
  UserWalletTransaction.findOne({ order: orderId, type: 'refund' })

export const findTransactionByTopup = (topupId) =>
  UserWalletTransaction.findOne({ topup: topupId })

// ─── Topup ────────────────────────────────────────────────────────────────────

export const createTopup = (data) => UserWalletTopup.create(data)

export const findPendingTopupByUser = (userId) =>
  UserWalletTopup.findOne({
    user: userId,
    status: TOPUP_STATUS.PENDING,
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).sort({ createdAt: -1 })

export const findTopupByRef = (transactionRef) =>
  UserWalletTopup.findOne({ transactionRef })

export const findTopupByOrderCode = (orderCode) =>
  UserWalletTopup.findOne({ orderCode })

export const updateTopup = (topupId, data) =>
  UserWalletTopup.findByIdAndUpdate(topupId, data, { returnDocument: 'after' })

export const findTopups = ({ filter, skip, limit, sortBy = 'createdAt', sortOrder = 'desc' }) =>
  UserWalletTopup.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)

export const countTopups = (filter) => UserWalletTopup.countDocuments(filter)

// ─── Unified activity feed ────────────────────────────────────────────────────

// ─── User Wallet Withdrawal ───────────────────────────────────────────────────

export const createWithdrawal = (data) => UserWalletWithdrawal.create(data)

export const findWithdrawalById = (id) =>
  UserWalletWithdrawal.findById(id)
    .populate('user', 'name email')
    .populate('approvedBy', 'name email')
    .populate('completedBy', 'name email')

export const findWithdrawals = ({ filter, skip, limit, sortBy = 'createdAt', sortOrder = 'desc' }) =>
  UserWalletWithdrawal.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name email')
    .populate('approvedBy', 'name email')
    .populate('completedBy', 'name email')

export const countWithdrawals = (filter) => UserWalletWithdrawal.countDocuments(filter)

export const updateWithdrawalById = (id, data, options = {}) =>
  UserWalletWithdrawal.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true, ...options })
    .populate('user', 'name email')
    .populate('approvedBy', 'name email')
    .populate('completedBy', 'name email')

export const hasPendingWithdrawal = (userId) =>
  UserWalletWithdrawal.exists({ user: userId, status: WITHDRAWAL_STATUS.PENDING })

// ─── Unified activity feed ────────────────────────────────────────────────────

export const findActivityFeed = async ({ userId, skip, limit }) => {
  const pipeline = [
    { $match: { user: userId } },
    {
      $lookup: {
        from: 'userwallettopups',
        localField: 'topup',
        foreignField: '_id',
        as: '_topupDoc',
      },
    },
    {
      $project: {
        kind: '$type',
        status: 1,
        amount: 1,
        balanceBefore: 1,
        balanceAfter: 1,
        description: 1,
        createdAt: 1,
        orderId: '$order',
        orderCode: { $arrayElemAt: ['$_topupDoc.orderCode', 0] },
        source: { $literal: 'wallet_transaction' },
      },
    },
    {
      $unionWith: {
        coll: 'userwallettopups',
        pipeline: [
          { $match: { user: userId, status: { $ne: 'completed' } } },
          {
            $project: {
              kind: { $literal: 'topup' },
              status: 1,
              amount: 1,
              balanceBefore: { $literal: null },
              balanceAfter: { $literal: null },
              description: { $literal: '' },
              createdAt: 1,
              orderId: { $literal: null },
              orderCode: '$orderCode',
              source: { $literal: 'topup_attempt' },
            },
          },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]

  const [result] = await UserWalletTransaction.aggregate(pipeline)
  return {
    items: result?.items ?? [],
    total: result?.totalCount?.[0]?.count ?? 0,
  }
}
