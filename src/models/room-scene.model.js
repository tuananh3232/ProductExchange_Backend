import mongoose from 'mongoose'

const roomSceneSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomProject',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Scene name is required'],
      trim: true,
    },
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
      widthPx: { type: Number, default: null },
      heightPx: { type: Number, default: null },
    },
    calibration: {
      start: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
      },
      end: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
      },
      realLengthCm: { type: Number, default: null },
      pixelsPerCm: { type: Number, default: null },
      calibratedAt: { type: Date, default: null },
    },
    placements: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
        cutoutPublicId: { type: String },
        view: {
          type: String,
          enum: ['front', 'left_angle', 'right_angle', 'back'],
        },
        x: { type: Number },
        y: { type: Number },
        scale: { type: Number, default: 1 },
        rotation: { type: Number, default: 0 },
        zIndex: { type: Number, default: 1 },
        opacity: { type: Number, default: 1 },
        locked: { type: Boolean, default: false },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

roomSceneSchema.index({ project: 1, createdAt: -1 })
roomSceneSchema.index({ owner: 1, updatedAt: -1 })

export default mongoose.model('RoomScene', roomSceneSchema)
