import mongoose from 'mongoose'

const roomProjectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      maxlength: [120, 'Name must not exceed 120 characters'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [1000, 'Description must not exceed 1000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'active',
    },
    isVipFeature: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

roomProjectSchema.index({ owner: 1 })
roomProjectSchema.index({ status: 1 })

export default mongoose.model('RoomProject', roomProjectSchema)
