import mongoose from 'mongoose'
import { MESSAGE_ACTOR_TYPE_ENUM, MESSAGE_ACTOR_TYPES } from './message.model.js'

export const CONVERSATION_TYPES = {
  DIRECT: 'DIRECT',
  SHOP: 'SHOP',
}

export const CONVERSATION_TYPE_ENUM = Object.values(CONVERSATION_TYPES)

const lastMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderType: {
      type: String,
      enum: MESSAGE_ACTOR_TYPE_ENUM,
      default: MESSAGE_ACTOR_TYPES.USER,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
    },
    content: {
      type: String,
      default: '',
    },
    messageType: {
      type: String,
      default: 'TEXT',
    },
    sentAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
)

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: CONVERSATION_TYPE_ENUM,
      required: true,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    participantKey: {
      type: String,
      default: null,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    shopCustomerKey: {
      type: String,
      default: null,
    },
    lastMessage: {
      type: lastMessageSchema,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

conversationSchema.index(
  { participantKey: 1 },
  { unique: true, partialFilterExpression: { type: CONVERSATION_TYPES.DIRECT, participantKey: { $type: 'string' } } }
)
conversationSchema.index(
  { shopCustomerKey: 1 },
  { unique: true, partialFilterExpression: { type: CONVERSATION_TYPES.SHOP, shopCustomerKey: { $type: 'string' } } }
)
conversationSchema.index({ participants: 1, updatedAt: -1 })
conversationSchema.index({ shopId: 1, updatedAt: -1 })
conversationSchema.index({ customerId: 1, updatedAt: -1 })

const Conversation = mongoose.model('Conversation', conversationSchema)

export default Conversation
