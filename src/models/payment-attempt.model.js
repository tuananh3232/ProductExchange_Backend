import mongoose from 'mongoose'
import { PAYMENT_ATTEMPT_STATUS, PAYMENT_ATTEMPT_STATUS_ENUM } from '../constants/commerce.constant.js'

const callbackSchema = new mongoose.Schema(
  {
    payloadHash: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
    providerStatus: { type: String, default: '' },
  },
  { _id: false }
)

const paymentAttemptSchema = new mongoose.Schema(
  {
    checkout: { type: mongoose.Schema.Types.ObjectId, ref: 'Checkout', default: null, index: true },
    legacyPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null, unique: true, sparse: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['payos', 'vnpay', 'wallet'], required: true, index: true },
    method: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    idempotencyKey: { type: String, required: true },
    merchantReference: { type: String, required: true },
    providerReference: { type: String, default: undefined },
    providerOrderCode: { type: Number, default: undefined },
    providerCreatedAt: { type: String, default: '' },
    providerTransactionDate: { type: String, default: '' },
    checkoutUrl: { type: String, default: null },
    status: { type: String, enum: PAYMENT_ATTEMPT_STATUS_ENUM, default: PAYMENT_ATTEMPT_STATUS.CREATED, index: true },
    callbackHistory: { type: [callbackSchema], default: [] },
    reconciliationState: { type: String, enum: ['none', 'matched', 'issue'], default: 'none' },
    failureReason: { type: String, default: '' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

paymentAttemptSchema.index({ buyer: 1, idempotencyKey: 1 }, { unique: true })
paymentAttemptSchema.index({ provider: 1, merchantReference: 1 }, { unique: true })
paymentAttemptSchema.index({ provider: 1, providerReference: 1 }, { unique: true, sparse: true })
paymentAttemptSchema.index({ provider: 1, providerOrderCode: 1 }, { unique: true, sparse: true })

export default mongoose.model('PaymentAttempt', paymentAttemptSchema)
