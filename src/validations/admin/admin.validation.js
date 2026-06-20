import Joi from 'joi'
import { ROLE_ENUM } from '../../constants/role.constant.js'
import {
  FEE_POLICY_STATUS_ENUM,
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS_ENUM,
  PRODUCT_STATUS_ENUM,
  SHOP_STATUS_ENUM,
  WITHDRAWAL_STATUS_ENUM,
} from '../../constants/status.constant.js'
import {
  FEE_BASE_AMOUNT_TYPE_ENUM,
  FEE_OWNER_TYPE_ENUM,
  FEE_ROUNDING_ENUM,
  FEE_TRANSACTION_TYPE_ENUM,
} from '../../constants/fee.constant.js'
import {
  LEDGER_TRANSACTION_TYPE_ENUM,
} from '../../constants/ledger.constant.js'

const objectId = Joi.string().trim().pattern(/^[a-f\d]{24}$/i)
const page = Joi.number().integer().min(1).default(1)
const limit = Joi.number().integer().min(1).max(100).default(10)
const search = Joi.string().trim().max(100).allow('')
const sortOrder = Joi.string().valid('asc', 'desc').default('desc')

const dateRange = {
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')),
  createdFrom: Joi.date().iso(),
  createdTo: Joi.date().iso().min(Joi.ref('createdFrom')),
}

const pagination = (sortFields) => ({
  page,
  limit,
  search,
  sortBy: Joi.string().valid(...sortFields).default('createdAt'),
  sortOrder,
})

export const adminUsersQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'name', 'email', 'isActive']),
  role: Joi.string().valid(...ROLE_ENUM),
  roles: Joi.string().custom((value, helpers) => {
    const roles = value.split(',').map((role) => role.trim()).filter(Boolean)
    if (!roles.length || roles.some((role) => !ROLE_ENUM.includes(role))) {
      return helpers.error('any.invalid')
    }
    return value
  }),
  isActive: Joi.boolean(),
  userId: objectId,
  ...dateRange,
})

export const adminProductsQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'title', 'price', 'status', 'stock']),
  status: Joi.string().valid(...PRODUCT_STATUS_ENUM),
  isActive: Joi.boolean(),
  ownerId: objectId,
  shopId: objectId,
  sellerId: objectId,
  categoryId: objectId,
  minAmount: Joi.number().min(0),
  maxAmount: Joi.number().min(Joi.ref('minAmount')),
  ...dateRange,
})

export const adminShopsQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'name', 'status']),
  status: Joi.string().valid(...SHOP_STATUS_ENUM),
  isActive: Joi.boolean(),
  ownerId: objectId,
  ...dateRange,
})

export const adminKycQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'kyc.submittedAt', 'kyc.reviewedAt', 'name', 'email']),
  status: Joi.string().valid('none', 'pending', 'approved', 'rejected'),
  userId: objectId,
  kycId: objectId,
  ...dateRange,
})

export const adminWithdrawalsQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'amount', 'status', 'approvedAt', 'completedAt']),
  status: Joi.string().valid(...WITHDRAWAL_STATUS_ENUM),
  shopId: objectId,
  userId: objectId,
  minAmount: Joi.number().min(0),
  maxAmount: Joi.number().min(Joi.ref('minAmount')),
  ...dateRange,
})

export const adminOrdersQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'status', 'paymentStatus', 'totalAmount']),
  orderCode: search,
  buyerId: objectId,
  shopId: objectId,
  sellerId: objectId,
  status: Joi.string().valid(...ORDER_STATUS_ENUM),
  paymentStatus: Joi.string().valid(...PAYMENT_STATUS_ENUM),
  paymentMethod: Joi.string().trim().max(50),
  minTotal: Joi.number().min(0),
  maxTotal: Joi.number().min(Joi.ref('minTotal')),
  ...dateRange,
})

export const adminPaymentsQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'status', 'amount', 'provider', 'method']),
  paymentCode: search,
  orderId: objectId,
  userId: objectId,
  provider: Joi.string().trim().max(50),
  paymentMethod: Joi.string().trim().max(50),
  status: Joi.string().valid(...PAYMENT_STATUS_ENUM),
  minAmount: Joi.number().min(0),
  maxAmount: Joi.number().min(Joi.ref('minAmount')),
  ...dateRange,
})

export const adminCategoriesQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'name', 'slug', 'isActive']),
  isActive: Joi.boolean(),
  status: Joi.string().valid('active', 'inactive', 'disabled'),
  ...dateRange,
})

export const adminFeePoliciesQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'effectiveFrom', 'transactionType', 'status', 'percent']),
  status: Joi.string().valid(...FEE_POLICY_STATUS_ENUM),
  transactionType: Joi.string().valid(...FEE_TRANSACTION_TYPE_ENUM),
  ownerType: Joi.string().valid(...FEE_OWNER_TYPE_ENUM),
  categoryId: objectId,
})

export const adminUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
  reason: Joi.string().trim().min(1).max(500).required(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminProductStatusSchema = Joi.object({
  status: Joi.string().valid(...PRODUCT_STATUS_ENUM, 'active', 'inactive').required(),
  reason: Joi.string().trim().min(1).max(500).required(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminOrderStatusSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUS_ENUM).required(),
  reason: Joi.string().trim().max(500).allow('').optional(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminOrderActionSchema = Joi.object({
  reason: Joi.string().trim().max(500).allow('').optional(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminPaymentStatusSchema = Joi.object({
  status: Joi.string().valid('failed', 'cancelled', 'refund_pending').required(),
  evidence: Joi.string().trim().min(1).max(1000).required(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminPaymentReconcileSchema = Joi.object({
  evidence: Joi.object({
    providerStatus: Joi.string().trim().max(100).optional(),
    transactionRef: Joi.string().trim().max(200).optional(),
    note: Joi.string().trim().max(1000).optional(),
  }).default({}),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminCategoryCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  slug: Joi.string().trim().max(160).optional(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  icon: Joi.string().trim().max(500).allow('').optional(),
  isActive: Joi.boolean().optional(),
})

export const adminCategoryUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  slug: Joi.string().trim().max(160).optional(),
  description: Joi.string().trim().max(1000).allow('').optional(),
  icon: Joi.string().trim().max(500).allow('').optional(),
  isActive: Joi.boolean().optional(),
}).min(1)

export const adminCategoryStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
  reason: Joi.string().trim().max(500).allow('').optional(),
  adminNote: Joi.string().trim().max(1000).allow('').optional(),
})

export const adminFeePolicyCreateSchema = Joi.object({
  transactionType: Joi.string().valid(...FEE_TRANSACTION_TYPE_ENUM).required(),
  ownerType: Joi.string().valid(...FEE_OWNER_TYPE_ENUM).required(),
  categoryId: objectId.allow(null),
  minAmount: Joi.number().min(0).allow(null),
  maxAmount: Joi.number().min(0).allow(null),
  percent: Joi.number().min(0).max(100).required(),
  minFee: Joi.number().min(0).default(0),
  maxFee: Joi.number().min(0).allow(null),
  fixedFee: Joi.number().min(0).default(0),
  baseAmountType: Joi.string().valid(...FEE_BASE_AMOUNT_TYPE_ENUM).required(),
  rounding: Joi.string().valid(...FEE_ROUNDING_ENUM).required(),
  status: Joi.string().valid(...FEE_POLICY_STATUS_ENUM).required(),
  effectiveFrom: Joi.date().iso().required(),
  effectiveTo: Joi.date().iso().greater(Joi.ref('effectiveFrom')).allow(null),
}).custom((value, helpers) => {
  if (value.maxAmount !== null && value.minAmount !== null && value.maxAmount <= value.minAmount) {
    return helpers.error('any.invalid')
  }

  return value
})

export const adminFeePolicyUpdateSchema = adminFeePolicyCreateSchema

export const adminFeePolicyPreviewSchema = Joi.object({
  transactionType: Joi.string().valid(...FEE_TRANSACTION_TYPE_ENUM).required(),
  ownerType: Joi.string().valid(...FEE_OWNER_TYPE_ENUM).required(),
  categoryId: objectId.allow(null),
  baseAmount: Joi.number().min(0).required(),
  transactionCreatedAt: Joi.date().iso().optional(),
})

export const adminPlatformLedgerQuerySchema = Joi.object({
  ...pagination(['createdAt', 'updatedAt', 'grossAmount', 'platformFee', 'netSettlementAmount']),
  transactionType: Joi.string().valid(...LEDGER_TRANSACTION_TYPE_ENUM),
  settlementStatus: Joi.string().valid(...['pending', 'held', 'settled', 'refunded', 'disputed']),
  orderId: objectId,
  reconciliationState: Joi.string().valid('all', 'issue', 'stuck'),
})

export const adminStatsQuerySchema = Joi.object({
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')),
  startDate: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().max(20)),
  endDate: Joi.alternatives().try(Joi.date().iso(), Joi.string().trim().max(20)),
  period: Joi.string().valid('day', 'month').default('day'),
  limit: Joi.number().integer().min(1).max(100).default(10),
})

export const adminAuditQuerySchema = Joi.object({
  page,
  limit,
  action: Joi.string().trim().max(100),
  targetType: Joi.string().trim().max(50),
  targetId: objectId,
  adminId: objectId,
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')),
  sortOrder,
})

export const adminActivityQuerySchema = Joi.object({
  page,
  limit,
  action: Joi.string().trim().max(100),
  targetType: Joi.string().trim().max(50),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')),
  sortOrder,
})

export const adminReportExportQuerySchema = Joi.object({
  type: Joi.string()
    .valid('users', 'shops', 'orders', 'payments', 'withdrawals', 'user_withdrawals', 'categories', 'platform_ledger', 'rental_claims', 'exchange_disputes')
    .required(),
  fromDate: Joi.date().iso().required(),
  toDate: Joi.date().iso().min(Joi.ref('fromDate')).required(),
  format: Joi.string().valid('csv').default('csv'),
})

export const adminNotificationQuerySchema = Joi.object({
  page,
  limit,
  sortOrder,
})

export const adminNotificationCreateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(150).required(),
  message: Joi.string().trim().min(1).max(1000).required(),
  targetType: Joi.string().valid('all', 'users', 'shops', 'roles').required(),
  targetIds: Joi.alternatives().conditional('targetType', {
    switch: [
      { is: 'all', then: Joi.array().items(Joi.string().trim()).max(0).default([]) },
      { is: 'roles', then: Joi.array().items(Joi.string().valid(...ROLE_ENUM)).min(1).max(100).required() },
      { is: 'users', then: Joi.array().items(objectId.required()).min(1).max(100).required() },
      { is: 'shops', then: Joi.array().items(objectId.required()).min(1).max(100).required() },
    ],
  }),
  targetUrl: Joi.string().trim().pattern(/^\/[^\s]*$/).max(500).default('/notifications'),
})

export const orderQuerySchema = Joi.object({
  page,
  limit,
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'status', 'totalAmount').default('createdAt'),
  sortOrder,
  scope: Joi.string().valid('buyer', 'shop', 'seller').default('buyer'),
  status: Joi.string().valid(...ORDER_STATUS_ENUM),
  shopId: objectId,
  sellerId: objectId,
  userId: objectId,
  ...dateRange,
})
