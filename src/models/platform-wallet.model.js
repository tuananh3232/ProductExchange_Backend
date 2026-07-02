import mongoose from 'mongoose'
import { PLATFORM_WALLET_KEY_ENUM } from '../constants/ledger.constant.js'

const platformWalletSchema = new mongoose.Schema(
  {
    walletKey: {
      type: String,
      enum: PLATFORM_WALLET_KEY_ENUM,
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalIn: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOut: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

const PlatformWallet = mongoose.model('PlatformWallet', platformWalletSchema)

export default PlatformWallet
