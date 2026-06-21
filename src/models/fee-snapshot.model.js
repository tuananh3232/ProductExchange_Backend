import mongoose from 'mongoose'
import {
  FEE_BASE_AMOUNT_TYPE_ENUM,
  FEE_OWNER_TYPE_ENUM,
  FEE_ROUNDING_ENUM,
  FEE_TRANSACTION_TYPE_ENUM,
} from '../constants/fee.constant.js'

const feeSnapshotSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    feePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeePolicy',
      default: null,
      index: true,
    },
    transactionType: {
      type: String,
      enum: FEE_TRANSACTION_TYPE_ENUM,
      required: true,
    },
    ownerType: {
      type: String,
      enum: FEE_OWNER_TYPE_ENUM,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    baseAmountType: {
      type: String,
      enum: FEE_BASE_AMOUNT_TYPE_ENUM,
      required: true,
    },
    rounding: {
      type: String,
      enum: FEE_ROUNDING_ENUM,
      required: true,
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    fixedFee: {
      type: Number,
      default: 0,
      min: 0,
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
    calculatedFee: {
      type: Number,
      required: true,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

feeSnapshotSchema.index({ sourceType: 1, sourceId: 1 })

const FeeSnapshot = mongoose.model('FeeSnapshot', feeSnapshotSchema)

export default FeeSnapshot
