import Category from '../../models/category.model.js'
import ExchangeOffer from '../../models/exchange-offer.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import Order from '../../models/order.model.js'
import Payment from '../../models/payment.model.js'
import RentalClaim from '../../models/rental-claim.model.js'
import Shop from '../../models/shop.model.js'
import User from '../../models/user.model.js'
import UserWalletWithdrawal from '../../models/user-wallet-withdrawal.model.js'
import WithdrawalRequest from '../../models/withdrawal-request.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const MAX_EXPORT_DAYS = 31
const MAX_EXPORT_ROWS = 500
const MAX_PREVIEW_ROWS = 50

const parseDate = (value, label) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${label} không hợp lệ`, HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }
  return parsed
}

const buildDateRange = ({ fromDate, toDate, field = 'createdAt', requireRange = false } = {}) => {
  if (requireRange && (!fromDate || !toDate)) {
    throw new AppError('fromDate và toDate là bắt buộc', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED)
  }

  if (!fromDate && !toDate) return {}

  const range = {}
  const start = fromDate ? parseDate(fromDate, 'fromDate') : null
  const end = toDate ? parseDate(toDate, 'toDate') : null

  if (start) range.$gte = start
  if (end) {
    end.setHours(23, 59, 59, 999)
    range.$lte = end
  }

  if (start && end && start > end) {
    throw new AppError('fromDate không được lớn hơn toDate', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  if (requireRange && start && end) {
    const durationDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    if (durationDays > MAX_EXPORT_DAYS) {
      throw new AppError(`Khoảng thời gian xuất báo cáo tối đa là ${MAX_EXPORT_DAYS} ngày`, HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
  }

  return { [field]: range }
}

const csvEscape = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const toCsv = (rows, columns) => {
  const header = columns.map((column) => csvEscape(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => csvEscape(column.value(row))).join(',')).join('\n')
  return [header, body].filter(Boolean).join('\n')
}

const exportConfig = {
  users: {
    model: User,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'name', value: (row) => row.name },
      { header: 'email', value: (row) => row.email },
      { header: 'roles', value: (row) => (row.roles || []).join('|') },
      { header: 'isActive', value: (row) => row.isActive },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  shops: {
    model: Shop,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'name', value: (row) => row.name },
      { header: 'slug', value: (row) => row.slug },
      { header: 'status', value: (row) => row.status },
      { header: 'owner', value: (row) => row.owner },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  orders: {
    model: Order,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'buyer', value: (row) => row.buyer },
      { header: 'shop', value: (row) => row.shop },
      { header: 'seller', value: (row) => row.seller },
      { header: 'status', value: (row) => row.status },
      { header: 'paymentStatus', value: (row) => row.paymentStatus },
      { header: 'totalAmount', value: (row) => row.totalAmount },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  payments: {
    model: Payment,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'buyer', value: (row) => row.buyer },
      { header: 'amount', value: (row) => row.amount },
      { header: 'provider', value: (row) => row.provider },
      { header: 'method', value: (row) => row.method },
      { header: 'status', value: (row) => row.status },
      { header: 'transactionRef', value: (row) => row.transactionRef },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  withdrawals: {
    model: WithdrawalRequest,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'shop', value: (row) => row.shop },
      { header: 'amount', value: (row) => row.amount },
      { header: 'status', value: (row) => row.status },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  user_withdrawals: {
    model: UserWalletWithdrawal,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'user', value: (row) => row.user },
      { header: 'amount', value: (row) => row.amount },
      { header: 'status', value: (row) => row.status },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  categories: {
    model: Category,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'name', value: (row) => row.name },
      { header: 'slug', value: (row) => row.slug },
      { header: 'isActive', value: (row) => row.isActive },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  platform_ledger: {
    model: LedgerTransaction,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'transactionType', value: (row) => row.transactionType },
      { header: 'referenceType', value: (row) => row.referenceType },
      { header: 'referenceId', value: (row) => row.referenceId },
      { header: 'grossAmount', value: (row) => row.grossAmount },
      { header: 'platformFee', value: (row) => row.platformFee },
      { header: 'netSettlementAmount', value: (row) => row.netSettlementAmount },
      { header: 'settlementStatus', value: (row) => row.settlementStatus },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  rental_claims: {
    model: RentalClaim,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'booking', value: (row) => row.booking },
      { header: 'ownerType', value: (row) => row.ownerType },
      { header: 'requestedAmount', value: (row) => row.requestedAmount },
      { header: 'approvedAmount', value: (row) => row.approvedAmount },
      { header: 'status', value: (row) => row.status },
      { header: 'reviewedAt', value: (row) => row.reviewedAt?.toISOString?.() || '' },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
  exchange_disputes: {
    model: ExchangeOffer,
    columns: [
      { header: 'id', value: (row) => row._id },
      { header: 'requesterSeller', value: (row) => row.requesterSeller },
      { header: 'receiverSeller', value: (row) => row.receiverSeller },
      { header: 'cashDifferenceAmount', value: (row) => row.cashDifferenceAmount },
      { header: 'platformFee', value: (row) => row.platformFee },
      { header: 'status', value: (row) => row.status },
      { header: 'resolution', value: (row) => row.resolution },
      { header: 'disputeOpenedAt', value: (row) => row.disputeOpenedAt?.toISOString?.() || '' },
      { header: 'resolvedAt', value: (row) => row.resolvedAt?.toISOString?.() || '' },
      { header: 'createdAt', value: (row) => row.createdAt?.toISOString?.() || '' },
    ],
  },
}

const getReportConfig = (type) => {
  const config = exportConfig[type]
  if (!config) {
    throw new AppError('Loại báo cáo không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }
  return config
}

const buildReportFilter = ({ type, fromDate, toDate }) => {
  const filter = buildDateRange({ fromDate, toDate, requireRange: true })
  if (type === 'exchange_disputes') {
    filter.disputeOpenedAt = { ...filter.createdAt, $exists: true }
    delete filter.createdAt
  }
  if (type === 'rental_claims') filter.ownerType = { $in: ['SELLER', 'SHOP'] }
  return filter
}

const serializePreviewValue = (value) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (value?._bsontype === 'ObjectId') return value.toString()
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

export const previewAdminReport = async ({ type, fromDate, toDate, page = 1, limit = 20 }) => {
  const config = getReportConfig(type)
  const filter = buildReportFilter({ type, fromDate, toDate })
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeLimit = Math.min(MAX_PREVIEW_ROWS, Math.max(1, Number.parseInt(limit, 10) || 20))
  const [records, total] = await Promise.all([
    config.model.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    config.model.countDocuments(filter),
  ])
  const rows = records.map((record) => Object.fromEntries(
    config.columns.map((column) => [column.header, serializePreviewValue(column.value(record))]),
  ))
  return {
    columns: config.columns.map((column) => column.header),
    rows,
    meta: {
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPrevPage: safePage > 1,
      },
      exportMaxRows: MAX_EXPORT_ROWS,
    },
  }
}

export const exportAdminReport = async ({ type, fromDate, toDate }) => {
  const config = getReportConfig(type)
  const filter = buildReportFilter({ type, fromDate, toDate })

  const rows = await config.model.find(filter).sort({ createdAt: -1 }).limit(MAX_EXPORT_ROWS).lean()

  return {
    filename: `admin-${type}-${fromDate}-${toDate}.csv`.replace(/[^a-z0-9_.-]/gi, '-'),
    content: toCsv(rows, config.columns),
    rowCount: rows.length,
    maxRows: MAX_EXPORT_ROWS,
  }
}
