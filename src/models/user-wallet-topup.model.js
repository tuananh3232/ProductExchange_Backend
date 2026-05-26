import mongoose from 'mongoose'
import { TOPUP_STATUS, TOPUP_STATUS_ENUM } from '../constants/status.constant.js'

const userWalletTopupSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserWallet',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: TOPUP_STATUS_ENUM,
      default: TOPUP_STATUS.PENDING,
      index: true,
    },
    // TOPUP_${orderCode}
    transactionRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderCode: {
      type: Number,
      required: true,
    },
    provider: {
      type: String,
      default: 'payos',
    },
    checkoutUrl: {
      type: String,
      default: null,
    },
    rawCallbackData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

const UserWalletTopup = mongoose.model('UserWalletTopup', userWalletTopupSchema)

export default UserWalletTopup
