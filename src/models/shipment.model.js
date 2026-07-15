import mongoose from 'mongoose'

const shipmentEventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const shipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    carrier: { type: String, required: true },
    trackingCode: { type: String, required: true },
    status: { type: String, enum: ['created', 'shipped', 'delivered'], default: 'created', index: true },
    proof: [{ url: { type: String, required: true }, publicId: { type: String, default: '' } }],
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    events: { type: [shipmentEventSchema], default: [] },
  },
  { timestamps: true, versionKey: false }
)

shipmentSchema.index({ carrier: 1, trackingCode: 1 }, { unique: true })

export default mongoose.model('Shipment', shipmentSchema)
