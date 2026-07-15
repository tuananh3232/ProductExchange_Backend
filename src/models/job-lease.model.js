import mongoose from 'mongoose'

const jobLeaseSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, unique: true },
    jobType: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'dead'], default: 'pending', index: true },
    runAt: { type: Date, required: true, index: true },
    lockedBy: { type: String, default: null },
    lockExpiresAt: { type: Date, default: null, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    lastError: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('JobLease', jobLeaseSchema)
