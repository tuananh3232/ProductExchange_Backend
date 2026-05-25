import Joi from 'joi'
import { MESSAGE_TYPE_ENUM } from '../../models/message.model.js'

const objectId = Joi.string().hex().length(24)

const attachmentSchema = Joi.object({
  url: Joi.string().uri().required(),
  publicId: Joi.string().allow('').default(''),
  name: Joi.string().allow('').default(''),
  mimeType: Joi.string().allow('').default(''),
  size: Joi.number().min(0).default(0),
})

export const createDirectConversationSchema = Joi.object({
  targetUserId: objectId.required(),
})

export const createShopConversationSchema = Joi.object({
  shopId: objectId.required(),
})

export const sendMessageSchema = Joi.object({
  conversationId: objectId.required(),
  content: Joi.string().trim().max(5000).allow('').default(''),
  messageType: Joi.string()
    .valid(...MESSAGE_TYPE_ENUM)
    .default('TEXT'),
  attachments: Joi.array().items(attachmentSchema).default([]),
})
  .or('content', 'attachments')
  .custom((value, helpers) => {
    const hasContent = typeof value.content === 'string' && value.content.trim().length > 0
    const hasAttachments = Array.isArray(value.attachments) && value.attachments.length > 0

    if (!hasContent && !hasAttachments) {
      return helpers.error('any.required')
    }

    return value
  }, 'non-empty message validation')

export const sendConversationMessageSchema = Joi.object({
  content: Joi.string().trim().max(5000).allow('').default(''),
  messageType: Joi.string()
    .valid(...MESSAGE_TYPE_ENUM)
    .default('TEXT'),
  attachments: Joi.array().items(attachmentSchema).default([]),
})
