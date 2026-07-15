import mongoose from 'mongoose'

const accountingAccountSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ['asset', 'liability', 'revenue'], required: true },
    ownerType: { type: String, enum: ['platform', 'user', 'shop', 'provider'], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('AccountingAccount', accountingAccountSchema)
