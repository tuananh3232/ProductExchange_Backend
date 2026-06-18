import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      default: '',
      maxlength: 100,
    },
    newStatus: {
      type: String,
      default: '',
      maxlength: 100,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    adminNote: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
