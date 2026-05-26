import UserWallet from '../../models/user-wallet.model.js'
import UserWalletTransaction from '../../models/user-wallet-transaction.model.js'
import UserWalletTopup from '../../models/user-wallet-topup.model.js'
import { TOPUP_STATUS } from '../../constants/status.constant.js'

// ─── Wallet ──────────────────────────────────────────────────────────────────

export const findByUser = (userId) =>
  UserWallet.findOne({ user: userId })

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

export const deductForOrder = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount, totalSpent: amount } },
    { returnDocument: 'after' }
  )

export const refundFromOrder = (userId, amount) =>
  UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount, totalSpent: -amount } },
    { returnDocument: 'after', upsert: true }
  )

// ─── Transactions ─────────────────────────────────────────────────────────────

export const createTransaction = (data) => UserWalletTransaction.create(data)

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
