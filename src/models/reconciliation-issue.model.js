import mongoose from 'mongoose'

const reconciliationIssueSchema = new mongoose.Schema(
  {
    issueKey: { type: String, required: true, unique: true },
    issueType: { type: String, required: true, index: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true, index: true },
    referenceType: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open', index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('ReconciliationIssue', reconciliationIssueSchema)
