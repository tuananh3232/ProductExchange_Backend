import Wallet from '../../models/wallet.model.js'
import WalletTransaction from '../../models/wallet-transaction.model.js'

export const findByShop = (shopId) =>
  Wallet.findOne({ shop: shopId }).populate('shop', 'name slug logo')

export const findOrCreateByShop = (shopId) =>
  Wallet.findOneAndUpdate(
    { shop: shopId },
    {},
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

export const incrementBalance = (shopId, amount) =>
  Wallet.findOneAndUpdate(
    { shop: shopId },
    {
      $inc: {
        balance: amount,
        totalEarned: amount,
      },
    },
    { returnDocument: 'after', upsert: true }
  )

export const deductForWithdrawal = (shopId, amount) =>
  Wallet.findOneAndUpdate(
    { shop: shopId, balance: { $gte: amount } },
    {
      $inc: {
        balance: -amount,
        pendingBalance: amount,
      },
    },
    { returnDocument: 'after' }
  )

export const completeWithdrawal = (shopId, amount) =>
  Wallet.findOneAndUpdate(
    { shop: shopId },
    {
      $inc: {
        pendingBalance: -amount,
        totalWithdrawn: amount,
      },
    },
    { returnDocument: 'after' }
  )

export const revertWithdrawal = (shopId, amount) =>
  Wallet.findOneAndUpdate(
    { shop: shopId },
    {
      $inc: {
        balance: amount,
        pendingBalance: -amount,
      },
    },
    { returnDocument: 'after' }
  )

export const createTransaction = (data) => WalletTransaction.create(data)

export const findTransactionByOrder = (orderId) =>
  WalletTransaction.findOne({ order: orderId })

export const findTransactions = ({ filter, skip, limit, sortBy = 'createdAt', sortOrder = 'desc' }) =>
  WalletTransaction.find(filter)
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(limit)
    .populate('order', 'totalAmount status')

export const countTransactions = (filter) => WalletTransaction.countDocuments(filter)
