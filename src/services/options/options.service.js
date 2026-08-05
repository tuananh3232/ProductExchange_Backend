import { COLOR_TONES, COMBO_CONSTRAINTS, COMBO_LABELS, DECOR_ROLES, PRODUCT_STYLES, ROOM_TYPES } from '../../constants/combo.constant.js'
import { ROLE_ENUM } from '../../constants/role.constant.js'
import {
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS_ENUM,
  PRODUCT_STATUS_ENUM,
  SHOP_STATUS_ENUM,
  WITHDRAWAL_STATUS_ENUM,
} from '../../constants/status.constant.js'
import * as categoryRepo from '../../repositories/category/category.repository.js'
import { ensureDefaultCategories } from '../category/category-seed.service.js'

const PRODUCT_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor']
const PRODUCT_LISTING_TYPES = ['sell', 'rental', 'exchange']
const PRODUCT_OWNER_TYPES = ['SHOP', 'SELLER']
const USER_STATUSES = ['active', 'inactive']
const KYC_STATUSES = ['none', 'pending', 'approved', 'rejected']
const PAYMENT_METHODS = ['PAYOS', 'WALLET']

const LABELS = {
  ...COMBO_LABELS,
  sell: 'Mua bán',
  rental: 'Cho thuê',
  exchange: 'Trao đổi',
  new: 'Mới',
  like_new: 'Như mới',
  good: 'Tốt',
  fair: 'Khá',
  poor: 'Cũ',
  available: 'Có sẵn',
  pending: 'Chờ xác nhận',
  pending_review: 'Chờ duyệt',
  pending_payment: 'Đang chờ thanh toán',
  confirmed: 'Đã xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao hàng',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy',
  failed: 'Thất bại',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  refund_pending: 'Đang chờ hoàn tiền',
  sold: 'Đã bán',
  hidden: 'Đã ẩn',
  active: 'Đang hoạt động',
  inactive: 'Không hoạt động',
  rejected: 'Từ chối',
  suspended: 'Tạm khóa',
  draft: 'Bản nháp',
  approved: 'Đã duyệt',
  completed: 'Hoàn tất',
  none: 'Chưa có',
  SHOP: 'Shop',
  SELLER: 'Người bán',
  PAYOS: 'PayOS',
  WALLET: 'Ví người dùng',
  newest: 'Mới nhất',
  oldest: 'Cũ nhất',
  price_asc: 'Giá thấp đến cao',
  price_desc: 'Giá cao đến thấp',
}

const toLabel = (value) =>
  LABELS[value] ||
  String(value)
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const toOptions = (values) => values.map((value) => ({ value, label: toLabel(value) }))

export const getComboOptions = () => ({
  styles: toOptions(PRODUCT_STYLES),
  roomTypes: toOptions(ROOM_TYPES),
  colorTones: toOptions(COLOR_TONES),
  decorRoles: toOptions(DECOR_ROLES),
  constraints: COMBO_CONSTRAINTS,
})

export const getProductFilterOptions = async () => {
  await ensureDefaultCategories()

  const rawCategories = await categoryRepo.findMany({ filter: { isActive: true }, limit: 200, sortBy: 'name', sortOrder: 1 })
  return {
    listingTypes: toOptions(PRODUCT_LISTING_TYPES),
    transactionModes: toOptions(PRODUCT_LISTING_TYPES),
    conditions: toOptions(PRODUCT_CONDITIONS),
    statuses: toOptions(PRODUCT_STATUS_ENUM),
    ownerTypes: toOptions(PRODUCT_OWNER_TYPES),
    sortOptions: toOptions(['newest', 'oldest', 'price_asc', 'price_desc']),
    categories: rawCategories.map((c) => ({ value: c._id.toString(), label: c.name })),
  }
}

export const getOrderFilterOptions = () => ({
  statuses: toOptions(ORDER_STATUS_ENUM),
  paymentStatuses: toOptions(PAYMENT_STATUS_ENUM),
  scopes: toOptions(['buyer', 'shop', 'seller']),
})

export const getAdminUsersFilterOptions = () => ({
  roles: toOptions(ROLE_ENUM),
  statuses: toOptions(USER_STATUSES),
})

export const getShopFilterOptions = () => ({
  statuses: toOptions(SHOP_STATUS_ENUM),
})

export const getKycFilterOptions = () => ({
  statuses: toOptions(KYC_STATUSES),
})

export const getWithdrawalFilterOptions = () => ({
  statuses: toOptions(WITHDRAWAL_STATUS_ENUM),
})

export const getPaymentOptions = () => ({
  methods: toOptions(PAYMENT_METHODS),
  statuses: toOptions(PAYMENT_STATUS_ENUM),
})

export const getCategoryFilterOptions = () => ({
  statuses: toOptions(['active', 'inactive', 'disabled']),
  sortOptions: toOptions(['newest', 'oldest', 'name']),
})

// periods: giá trị thực từ stats.service.js — normalizePeriod chỉ nhận 'day' | 'month'
const ANALYTICS_LABELS = { day: 'Theo ngày', month: 'Theo tháng' }
const STATS_PERIODS = ['day', 'month']

export const getAnalyticsFilterOptions = () => ({
  periods: STATS_PERIODS.map((v) => ({ value: v, label: ANALYTICS_LABELS[v] })),
})
