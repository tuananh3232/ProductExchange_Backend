import mongoose from 'mongoose'
import {
  WALLET_TRANSACTION_TYPE,
  WALLET_TRANSACTION_TYPE_ENUM,
  WALLET_TRANSACTION_STATUS,
  WALLET_TRANSACTION_STATUS_ENUM,
} from '../constants/status.constant.js'

const walletTransactionSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: WALLET_TRANSACTION_TYPE_ENUM,
      required: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
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

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema)

export default WalletTransaction
