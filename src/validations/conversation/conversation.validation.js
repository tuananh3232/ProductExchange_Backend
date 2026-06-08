import Joi from 'joi'
import { MESSAGE_ACTOR_TYPE_ENUM, MESSAGE_ACTOR_TYPES, MESSAGE_TYPE_ENUM, MESSAGE_TYPES } from '../../models/message.model.js'

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

export const listConversationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().trim().max(50),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  scope: Joi.string().valid('main', 'workspace').default('main'),
  shopId: Joi.when('scope', {
    is: 'workspace',
    then: objectId.required(),
    otherwise: objectId.optional(),
  }),
})

export const sendConversationMessageSchema = Joi.object({
  content: Joi.string().trim().max(5000).allow('').default(''),
  messageType: Joi.string()
    .valid(...MESSAGE_TYPE_ENUM)
    .default('TEXT'),
  attachments: Joi.array().items(attachmentSchema).default([]),
  actingAs: Joi.string()
    .valid(...MESSAGE_ACTOR_TYPE_ENUM)
    .default(MESSAGE_ACTOR_TYPES.USER),
  shopId: Joi.when('actingAs', {
    is: MESSAGE_ACTOR_TYPES.SHOP,
    then: objectId.required(),
    otherwise: objectId.optional(),
  }),
})
  .custom((value, helpers) => {
    const hasContent = typeof value.content === 'string' && value.content.trim().length > 0
    const hasAttachments = Array.isArray(value.attachments) && value.attachments.length > 0

    if (value.messageType === MESSAGE_TYPES.TEXT && !hasContent) {
      return helpers.error('any.required')
    }

    if (!hasContent && !hasAttachments) {
      return helpers.error('any.required')
    }

    return value
  }, 'chat message actor validation')
