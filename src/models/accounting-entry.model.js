import mongoose from 'mongoose'

const accountingEntrySchema = new mongoose.Schema(
  {
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingTransaction', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingAccount', required: true, index: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false }
)

accountingEntrySchema.index({ transaction: 1, account: 1, direction: 1 })

export default mongoose.model('AccountingEntry', accountingEntrySchema)
