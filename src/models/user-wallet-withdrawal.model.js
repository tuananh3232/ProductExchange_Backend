import mongoose from 'mongoose'
import { WITHDRAWAL_STATUS, WITHDRAWAL_STATUS_ENUM } from '../constants/status.constant.js'

const userWalletWithdrawalSchema = new mongoose.Schema(
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
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    bankInfo: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
      bankBranch: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUS_ENUM,
      default: WITHDRAWAL_STATUS.PENDING,
      index: true,
    },
    note: {
      type: String,
      default: '',
    },
    adminNote: {
      type: String,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    transferProof: {
      transactionId: { type: String, default: '' },
      transferDate: { type: Date, default: null },
      bankTransferRef: { type: String, default: '' },
      note: { type: String, default: '' },
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

const UserWalletWithdrawal = mongoose.model('UserWalletWithdrawal', userWalletWithdrawalSchema)

export default UserWalletWithdrawal
