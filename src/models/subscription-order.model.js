import mongoose from 'mongoose'

const subscriptionOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    amount: { type: Number, required: true },
    orderCode: { type: Number, required: true, unique: true },
    transactionRef: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true },
    paymentMethod: { type: String, enum: ['payos', 'wallet'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'cancelled', 'failed'], default: 'pending' },
    checkoutUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
    rawCallbackData: { type: mongoose.Schema.Types.Mixed, default: null },
    failureReason: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
)

subscriptionOrderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true })

const SubscriptionOrder = mongoose.model('SubscriptionOrder', subscriptionOrderSchema)
export default SubscriptionOrder
