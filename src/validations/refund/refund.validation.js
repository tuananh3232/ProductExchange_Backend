import Joi from 'joi'

const evidence = Joi.array().items(Joi.object({ url: Joi.string().uri().required(), publicId: Joi.string().allow('') })).max(10)

export const createCaseSchema = Joi.object({
  type: Joi.string().valid('return', 'dispute').required(),
  reason: Joi.string().trim().min(10).max(2000).required(),
  evidence: evidence.default([]),
})

export const resolveCaseSchema = Joi.object({
  resolution: Joi.string().valid('complete', 'full_refund', 'partial_refund', 'reject').required(),
  amount: Joi.number().integer().min(1).when('resolution', { is: 'partial_refund', then: Joi.required(), otherwise: Joi.optional() }),
  note: Joi.string().trim().max(2000).allow('').default(''),
})

export const manualRefundSchema = Joi.object({ evidence: Joi.object({
  transactionId: Joi.string().trim().required(),
  bankTransferRef: Joi.string().trim().required(),
  transferredAt: Joi.date().required(),
  note: Joi.string().allow('').default(''),
}).required() })
