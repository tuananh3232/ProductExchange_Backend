import mongoose from 'mongoose'
import {
  LEDGER_REFERENCE_TYPE_ENUM,
  LEDGER_TRANSACTION_TYPE_ENUM,
} from '../constants/ledger.constant.js'
import { SETTLEMENT_STATUS_ENUM } from '../constants/status.constant.js'

const ledgerTransactionSchema = new mongoose.Schema(
  {
    transactionType: {
      type: String,
      enum: LEDGER_TRANSACTION_TYPE_ENUM,
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: LEDGER_REFERENCE_TYPE_ENUM,
      required: true,
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
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
    netSettlementAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    settlementStatus: {
      type: String,
      enum: SETTLEMENT_STATUS_ENUM,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: '',
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
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

ledgerTransactionSchema.index({ referenceType: 1, referenceId: 1, transactionType: 1 }, { unique: true })

const LedgerTransaction = mongoose.model('LedgerTransaction', ledgerTransactionSchema)

export default LedgerTransaction
