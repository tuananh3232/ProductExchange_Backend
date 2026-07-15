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

export const respondCaseSchema = Joi.object({
  response: Joi.string().trim().min(10).max(2000).required(),
})

const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}

export const listOrderCasesSchema = Joi.object({
  ...pagination,
  status: Joi.string().valid('open', 'seller_responded', 'under_review', 'resolved', 'rejected'),
  type: Joi.string().valid('return', 'dispute'),
  orderId: Joi.string().hex().length(24),
})

export const listRefundsSchema = Joi.object({
  ...pagination,
  status: Joi.string().valid('requested', 'processing', 'succeeded', 'failed', 'manual_required'),
  source: Joi.string().valid('wallet', 'payos', 'vnpay'),
  orderId: Joi.string().hex().length(24),
})

export const listPaymentAttemptsSchema = Joi.object({
  ...pagination,
  status: Joi.string().valid('created', 'pending', 'succeeded', 'failed', 'cancelled', 'expired'),
  provider: Joi.string().valid('wallet', 'payos', 'vnpay'),
  reconciliationState: Joi.string().valid('none', 'matched', 'issue'),
})
