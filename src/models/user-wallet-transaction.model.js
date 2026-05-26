import mongoose from 'mongoose'
import {
  USER_WALLET_TRANSACTION_TYPE,
  USER_WALLET_TRANSACTION_TYPE_ENUM,
  WALLET_TRANSACTION_STATUS,
  WALLET_TRANSACTION_STATUS_ENUM,
} from '../constants/status.constant.js'

const userWalletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserWallet',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    topup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserWalletTopup',
      default: null,
    },
    type: {
      type: String,
      enum: USER_WALLET_TRANSACTION_TYPE_ENUM,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: WALLET_TRANSACTION_STATUS_ENUM,
      default: WALLET_TRANSACTION_STATUS.COMPLETED,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

const UserWalletTransaction = mongoose.model('UserWalletTransaction', userWalletTransactionSchema)

export default UserWalletTransaction
