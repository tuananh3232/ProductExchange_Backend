import mongoose from 'mongoose'

export const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
}

export const MESSAGE_TYPE_ENUM = Object.values(MESSAGE_TYPES)

export const MESSAGE_ACTOR_TYPES = {
  USER: 'USER',
  SHOP: 'SHOP',
}

export const MESSAGE_ACTOR_TYPE_ENUM = Object.values(MESSAGE_ACTOR_TYPES)

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      default: '',
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    mimeType: {
      type: String,
      default: '',
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
)

const readBySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: MESSAGE_ACTOR_TYPE_ENUM,
      default: MESSAGE_ACTOR_TYPES.USER,
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    senderShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [5000, 'Message content must not exceed 5000 characters'],
    },
    messageType: {
      type: String,
      enum: MESSAGE_TYPE_ENUM,
      default: MESSAGE_TYPES.TEXT,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    readBy: {
      type: [readBySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

messageSchema.index({ conversationId: 1, createdAt: -1 })
messageSchema.index({ 'readBy.userId': 1 })
messageSchema.index({ senderType: 1, senderShopId: 1 })

const Message = mongoose.model('Message', messageSchema)

export default Message
