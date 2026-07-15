import mongoose from 'mongoose'

const idempotencyCommandSchema = new mongoose.Schema(
  {
    commandKey: { type: String, required: true, unique: true },
    ownerToken: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed'], default: 'processing', index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    lockExpiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('IdempotencyCommand', idempotencyCommandSchema)
