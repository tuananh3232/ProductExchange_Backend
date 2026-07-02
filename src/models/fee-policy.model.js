import mongoose from 'mongoose'
import {
  FEE_BASE_AMOUNT_TYPE_ENUM,
  FEE_OWNER_TYPE_ENUM,
  FEE_ROUNDING_ENUM,
  FEE_TRANSACTION_TYPE_ENUM,
} from '../constants/fee.constant.js'
import { FEE_POLICY_STATUS, FEE_POLICY_STATUS_ENUM } from '../constants/status.constant.js'

const feePolicySchema = new mongoose.Schema(
  {
    transactionType: {
      type: String,
      enum: FEE_TRANSACTION_TYPE_ENUM,
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: FEE_OWNER_TYPE_ENUM,
      required: true,
      default: 'ALL',
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    minAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    maxAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    minFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxFee: {
      type: Number,
      default: null,
      min: 0,
    },
    fixedFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    baseAmountType: {
      type: String,
      enum: FEE_BASE_AMOUNT_TYPE_ENUM,
      required: true,
    },
    rounding: {
      type: String,
      enum: FEE_ROUNDING_ENUM,
      default: 'ROUND',
    },
    status: {
      type: String,
      enum: FEE_POLICY_STATUS_ENUM,
      default: FEE_POLICY_STATUS.DRAFT,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    disabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

feePolicySchema.index({ transactionType: 1, ownerType: 1, status: 1, effectiveFrom: -1 })
feePolicySchema.index({ transactionType: 1, categoryId: 1, status: 1 })

const FeePolicy = mongoose.model('FeePolicy', feePolicySchema)

export default FeePolicy
