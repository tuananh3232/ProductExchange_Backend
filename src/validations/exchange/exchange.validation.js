import Joi from 'joi'
import { EXCHANGE_STATUS_ENUM } from '../../constants/status.constant.js'

const objectId = Joi.string().trim().pattern(/^[a-f\d]{24}$/i)
const page = Joi.number().integer().min(1).default(1)
const limit = Joi.number().integer().min(1).max(100).default(10)

export const exchangeOffersQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'status', 'cashDifferenceAmount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid(...EXCHANGE_STATUS_ENUM),
})

export const createExchangeOfferSchema = Joi.object({
  requesterProductId: objectId.required(),
  receiverProductId: objectId.required(),
  note: Joi.string().trim().max(1000).allow('').optional(),
})

export const counterExchangeOfferSchema = Joi.object({
  requesterProductId: objectId.optional(),
  receiverProductId: objectId.optional(),
  note: Joi.string().trim().max(1000).allow('').optional(),
}).or('requesterProductId', 'receiverProductId', 'note')

export const exchangeActionSchema = Joi.object({
  note: Joi.string().trim().max(1000).allow('').optional(),
  reason: Joi.string().trim().max(1000).allow('').optional(),
})

export const exchangeDisputeSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
})

export const adminExchangeOffersQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'status', 'cashDifferenceAmount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid(...EXCHANGE_STATUS_ENUM),
  sellerId: objectId,
  onlyDisputed: Joi.boolean().default(false),
})

export const adminResolveExchangeDisputeSchema = Joi.object({
  resolution: Joi.string().valid('complete', 'cancel_refund').required(),
  note: Joi.string().trim().max(1000).allow('').optional(),
})
