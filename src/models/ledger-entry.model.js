import mongoose from 'mongoose'
import {
  LEDGER_ENTRY_DIRECTION_ENUM,
  PLATFORM_WALLET_KEY_ENUM,
} from '../constants/ledger.constant.js'

const ledgerEntrySchema = new mongoose.Schema(
  {
    ledgerTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerTransaction',
      required: true,
      index: true,
    },
    walletKey: {
      type: String,
      enum: PLATFORM_WALLET_KEY_ENUM,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: LEDGER_ENTRY_DIRECTION_ENUM,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    counterpartyType: {
      type: String,
      default: '',
      maxlength: 50,
    },
    counterpartyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    note: {
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

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema)

export default LedgerEntry
