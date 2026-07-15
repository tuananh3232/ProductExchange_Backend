import mongoose from 'mongoose'

const orderCaseSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['return', 'dispute'], required: true, index: true },
    status: { type: String, enum: ['open', 'seller_responded', 'under_review', 'resolved', 'rejected'], default: 'open', index: true },
    reason: { type: String, required: true, maxlength: 2000 },
    evidence: [{ url: { type: String, required: true }, publicId: { type: String, default: '' } }],
    sellerResponse: { type: String, default: '', maxlength: 2000 },
    resolution: { type: String, enum: ['none', 'complete', 'full_refund', 'partial_refund', 'reject'], default: 'none' },
    resolutionAmount: { type: Number, default: 0, min: 0 },
    resolutionNote: { type: String, default: '', maxlength: 2000 },
    resolutionIdempotencyKey: { type: String, default: undefined },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

orderCaseSchema.index({ order: 1, status: 1 })
orderCaseSchema.index({ resolutionIdempotencyKey: 1 }, { unique: true, sparse: true })

export default mongoose.model('OrderCase', orderCaseSchema)
