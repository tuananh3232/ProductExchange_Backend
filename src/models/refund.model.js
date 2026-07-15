import mongoose from 'mongoose'
import { REFUND_STATUS, REFUND_STATUS_ENUM } from '../constants/commerce.constant.js'

const refundSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    paymentAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAttempt', required: true, index: true },
    orderCase: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderCase', default: null },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    source: { type: String, enum: ['wallet', 'payos', 'vnpay'], required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: { type: String, enum: REFUND_STATUS_ENUM, default: REFUND_STATUS.REQUESTED, index: true },
    providerReference: { type: String, default: null },
    evidence: {
      transactionId: { type: String, default: '' },
      bankTransferRef: { type: String, default: undefined },
      transferredAt: { type: Date, default: null },
      note: { type: String, default: '' },
    },
    failureReason: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

refundSchema.index({ 'evidence.bankTransferRef': 1 }, { unique: true, sparse: true })

export default mongoose.model('Refund', refundSchema)
