import mongoose from 'mongoose'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TARGET_TYPES,
  NOTIFICATION_TYPES,
} from '../constants/notification.constant.js'

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    targetType: {
      type: String,
      enum: Object.values(NOTIFICATION_TARGET_TYPES),
      default: NOTIFICATION_TARGET_TYPES.SYSTEM,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actionUrl: { type: String, default: null },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITIES),
      default: NOTIFICATION_PRIORITIES.NORMAL,
    },
    channels: {
      type: [{ type: String, enum: Object.values(NOTIFICATION_CHANNELS) }],
      default: [NOTIFICATION_CHANNELS.IN_APP],
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
)

notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1 })
notificationSchema.index({ targetType: 1, targetId: 1 })

export default mongoose.model('Notification', notificationSchema)

