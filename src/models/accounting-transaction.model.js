import mongoose from 'mongoose'

const accountingTransactionSchema = new mongoose.Schema(
  {
    commandKey: { type: String, required: true, unique: true },
    transactionType: { type: String, required: true, index: true },
    referenceType: { type: String, required: true, index: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    description: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('AccountingTransaction', accountingTransactionSchema)
