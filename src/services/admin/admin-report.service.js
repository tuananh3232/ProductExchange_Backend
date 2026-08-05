import Category from '../../models/category.model.js'
import ExchangeOffer from '../../models/exchange-offer.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import Order from '../../models/order.model.js'
import Payment from '../../models/payment.model.js'
import RentalClaim from '../../models/rental-claim.model.js'
import Shop from '../../models/shop.model.js'
import User from '../../models/user.model.js'
import UserWalletWithdrawal from '../../models/user-wallet-withdrawal.model.js'
import SubscriptionOrder from '../../models/subscription-order.model.js'
import WithdrawalRequest from '../../models/withdrawal-request.model.js'
import Wallet from '../../models/wallet.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'

const MAX_EXPORT_DAYS = 31
const MAX_EXPORT_ROWS = 500

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

  if (start && end && start > end) {
    throw new AppError('fromDate không được lớn hơn toDate', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  if (requireRange && start && end) {
    const durationDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    if (durationDays > MAX_EXPORT_DAYS) {
      throw new AppError(`Khoảng thời gian xuất báo cáo tối đa là ${MAX_EXPORT_DAYS} ngày`, HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
    }
  }

  if (start) range.$gte = start
  if (end) {
    end.setHours(23, 59, 59, 999)
    range.$lte = end
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

const formatDate = (value) => value?.toISOString?.() || value || ''
const getName = (value) => (value && typeof value === 'object' ? value.name || value.email || value._id : value) || ''
const getId = (value) => (value && typeof value === 'object' ? value._id : value) || ''

const exportConfig = {
  users: {
    model: User,
    columns: [
      { header: 'Ngày tạo', value: (row) => formatDate(row.createdAt) },
      { header: 'Họ tên', value: (row) => row.name },
      { header: 'Email', value: (row) => row.email },
      { header: 'Số điện thoại', value: (row) => row.phone },
      { header: 'Vai trò', value: (row) => (row.roles || []).join(', ') },
      { header: 'Trạng thái tài khoản', value: (row) => (row.isActive ? 'Đang hoạt động' : 'Đã khoá') },
      { header: 'Trạng thái VIP', value: (row) => row.vip?.expiresAt && new Date(row.vip.expiresAt) > new Date() ? `Đang hoạt động (${row.vip.plan || ''})` : 'Không hoạt động' },
      { header: 'Tổng đơn đã mua', value: (row) => row.reportStats?.orderCount || 0 },
      { header: 'Tổng tiền đã chi', value: (row) => row.reportStats?.totalSpent || 0 },
      { header: 'Số dư ví người dùng', value: (row) => row.reportStats?.walletBalance || 0 },
      { header: 'Tổng tiền đã nạp', value: (row) => row.reportStats?.totalTopUp || 0 },
    ],
  },
  shops: {
    model: Shop,
    columns: [
      { header: 'Ngày tạo', value: (row) => formatDate(row.createdAt) },
      { header: 'Tên shop', value: (row) => row.name },
      { header: 'Tên chủ shop', value: (row) => getName(row.owner) },
      { header: 'Email', value: (row) => row.owner?.email },
      { header: 'Số điện thoại', value: (row) => row.owner?.phone || row.phone },
      { header: 'Trạng thái', value: (row) => row.status },
      { header: 'Tổng đơn hàng', value: (row) => row.reportStats?.orderCount || 0 },
      { header: 'Doanh thu gộp', value: (row) => row.reportStats?.grossRevenue || 0 },
      { header: 'Phí nền tảng', value: (row) => row.reportStats?.platformFee || 0 },
      { header: 'Doanh thu ròng của shop', value: (row) => row.reportStats?.netRevenue || 0 },
      { header: 'Số dư ví shop', value: (row) => row.reportStats?.walletBalance || 0 },
      { header: 'Tổng tiền đã rút', value: (row) => row.reportStats?.totalWithdrawn || 0 },
    ],
    populate: [{ path: 'owner', select: 'name email phone' }],
  },
  orders: {
    model: Order,
    columns: [
      { header: 'Ngày tạo', value: (row) => formatDate(row.createdAt) },
      { header: 'Mã đơn hàng', value: (row) => getId(row._id) },
      { header: 'Khách hàng', value: (row) => getName(row.buyer) },
      { header: 'Shop', value: (row) => getName(row.shop) },
      { header: 'Người bán', value: (row) => getName(row.seller) },
      { header: 'Trạng thái đơn hàng', value: (row) => row.status },
      { header: 'Trạng thái thanh toán', value: (row) => row.paymentStatus },
      { header: 'Thành tiền', value: (row) => row.totalAmount },
      { header: 'Phí nền tảng', value: (row) => row.totalPlatformFee },
      { header: 'Tiền shop/seller nhận', value: (row) => row.netSettlementAmount },
      { header: 'Ngày thanh toán', value: (row) => formatDate(row.paidAt) },
      { header: 'Ngày giao hàng', value: (row) => formatDate(row.deliveredAt) },
    ],
    populate: [
      { path: 'buyer', select: 'name email phone' },
      { path: 'shop', select: 'name' },
      { path: 'seller', select: 'name email phone' },
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
      { header: 'Ngày tạo', value: (row) => formatDate(row.createdAt) },
      { header: 'Tên shop', value: (row) => getName(row.shop) },
      { header: 'Tên chủ shop', value: (row) => getName(row.shop?.owner) },
      { header: 'Số tiền yêu cầu rút', value: (row) => row.amount },
      { header: 'Trạng thái yêu cầu', value: (row) => row.status },
      { header: 'Ngân hàng', value: (row) => row.bankInfo?.bankName },
      { header: 'Số tài khoản', value: (row) => row.bankInfo?.accountNumber },
      { header: 'Tên chủ tài khoản', value: (row) => row.bankInfo?.accountName },
      { header: 'Thời gian duyệt', value: (row) => formatDate(row.approvedAt) },
      { header: 'Thời gian hoàn tất', value: (row) => formatDate(row.completedAt) },
      { header: 'Ghi chú admin', value: (row) => row.adminNote },
    ],
    populate: [{ path: 'shop', select: 'name owner', populate: { path: 'owner', select: 'name email phone' } }],
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
      { header: 'Thời gian giao dịch', value: (row) => formatDate(row.createdAt) },
      { header: 'Loại giao dịch', value: (row) => row.transactionType },
      { header: 'Nguồn giao dịch', value: (row) => row.source || row.referenceType },
      { header: 'Mã đơn', value: (row) => getId(row.order) || getId(row.referenceId) },
      { header: 'Khách hàng', value: (row) => getName(row.order?.buyer) },
      { header: 'Shop/Người bán', value: (row) => getName(row.order?.shop) || getName(row.order?.seller) },
      { header: 'Tổng tiền', value: (row) => row.grossAmount },
      { header: 'Phí nền tảng', value: (row) => row.platformFee },
      { header: 'Tiền Shop/Người bán nhận', value: (row) => row.netSettlementAmount },
      { header: 'Phương thức', value: (row) => row.order?.paymentMethod || row.metadata?.paymentMethod },
      { header: 'Trạng thái thanh toán', value: (row) => row.order?.paymentStatus || row.settlementStatus },
      { header: 'Ghi chú', value: (row) => row.description },
    ],
    populate: [{ path: 'order', select: 'buyer shop seller paymentMethod paymentStatus', populate: [{ path: 'buyer', select: 'name' }, { path: 'shop', select: 'name' }, { path: 'seller', select: 'name' }] }],
  },
  vip_subscriptions: {
    model: SubscriptionOrder,
    columns: [
      { header: 'Loại giao dịch', value: () => 'Doanh thu gói VIP' },
      { header: 'Nguồn giao dịch', value: () => 'Gói VIP' },
      { header: 'Tổng tiền', value: (row) => row.amount },
      { header: 'Ghi chú', value: (row) => `User ${getName(row.user)} mua gói VIP ${row.plan || ''}` },
    ],
    populate: [{ path: 'user', select: 'name email' }],
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

const enrichReportRows = async (type, rows) => {
  if (type === 'users') {
    const userIds = rows.map((row) => row._id)
    const [orderStats, wallets] = await Promise.all([
      Order.aggregate([
        { $match: { buyer: { $in: userIds }, isActive: true } },
        { $group: { _id: '$buyer', orderCount: { $sum: 1 }, totalSpent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } } } },
      ]),
      UserWallet.find({ user: { $in: userIds } }).lean(),
    ])
    const statsByUser = new Map(orderStats.map((item) => [String(item._id), item]))
    const walletsByUser = new Map(wallets.map((wallet) => [String(wallet.user), wallet]))
    return rows.map((row) => {
      const stats = statsByUser.get(String(row._id)) || {}
      const wallet = walletsByUser.get(String(row._id)) || {}
      return {
        ...row,
        reportStats: {
          orderCount: stats.orderCount || 0,
          totalSpent: stats.totalSpent || wallet.totalSpent || 0,
          walletBalance: wallet.balance || 0,
          totalTopUp: wallet.totalTopUp || 0,
        },
      }
    })
  }

  if (type === 'shops') {
    const shopIds = rows.map((row) => row._id)
    const [orderStats, wallets] = await Promise.all([
      Order.aggregate([
        { $match: { shop: { $in: shopIds }, isActive: true } },
        { $group: { _id: '$shop', orderCount: { $sum: 1 }, grossRevenue: { $sum: '$totalAmount' }, platformFee: { $sum: '$totalPlatformFee' }, netRevenue: { $sum: '$netSettlementAmount' } } },
      ]),
      Wallet.find({ shop: { $in: shopIds } }).lean(),
    ])
    const statsByShop = new Map(orderStats.map((item) => [String(item._id), item]))
    const walletsByShop = new Map(wallets.map((wallet) => [String(wallet.shop), wallet]))
    return rows.map((row) => {
      const stats = statsByShop.get(String(row._id)) || {}
      const wallet = walletsByShop.get(String(row._id)) || {}
      return {
        ...row,
        reportStats: {
          orderCount: stats.orderCount || 0,
          grossRevenue: stats.grossRevenue || 0,
          platformFee: stats.platformFee || 0,
          netRevenue: stats.netRevenue || 0,
          walletBalance: wallet.balance || 0,
          totalWithdrawn: wallet.totalWithdrawn || 0,
        },
      }
    })
  }

  return rows
}

export const exportAdminReport = async ({ type, fromDate, toDate }) => {
  const config = exportConfig[type]
  if (!config) {
    throw new AppError('Loại báo cáo không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const filter = buildDateRange({ fromDate, toDate, requireRange: true })
  if (type === 'exchange_disputes') {
    filter.disputeOpenedAt = filter.createdAt
    delete filter.createdAt
    filter.disputeOpenedAt = {
      ...filter.disputeOpenedAt,
      $exists: true,
    }
  }

  if (type === 'rental_claims') {
    filter.ownerType = { $in: ['SELLER', 'SHOP'] }
  }

  if (type === 'vip_subscriptions') {
    filter.status = 'completed'
    filter.paidAt = filter.createdAt
    delete filter.createdAt
  }

  let query = config.model.find(filter).sort({ createdAt: -1 }).limit(MAX_EXPORT_ROWS)
  for (const populate of config.populate || []) {
    query = query.populate(populate)
  }
  const rows = await enrichReportRows(type, await query.lean())

  return {
    filename: `admin-${type}-${fromDate}-${toDate}.csv`.replace(/[^a-z0-9_.-]/gi, '-'),
    content: toCsv(rows, config.columns),
    rowCount: rows.length,
    maxRows: MAX_EXPORT_ROWS,
  }
}
