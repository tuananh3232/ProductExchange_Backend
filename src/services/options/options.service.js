import { COLOR_TONES, DECOR_ROLES, PRODUCT_STYLES, ROOM_TYPES } from '../../constants/combo.constant.js'
import { ROLE_ENUM } from '../../constants/role.constant.js'
import {
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS_ENUM,
  PRODUCT_STATUS_ENUM,
  SHOP_STATUS_ENUM,
  WITHDRAWAL_STATUS_ENUM,
} from '../../constants/status.constant.js'

const PRODUCT_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor']
const PRODUCT_LISTING_TYPES = ['sell']
const PRODUCT_OWNER_TYPES = ['SHOP', 'SELLER']
const USER_STATUSES = ['active', 'inactive']
const KYC_STATUSES = ['none', 'pending', 'approved', 'rejected']
const PAYMENT_METHODS = ['PAYOS', 'VNPAY', 'WALLET']

const LABELS = {
  minimalist: 'Minimalist',
  modern: 'Modern',
  vintage: 'Vintage',
  luxury: 'Luxury',
  korean: 'Korean',
  bohemian: 'Bohemian',
  bedroom: 'Bedroom',
  living_room: 'Living Room',
  kitchen: 'Kitchen',
  workspace: 'Workspace',
  warm: 'Warm',
  cool: 'Cool',
  neutral: 'Neutral',
  dark: 'Dark',
  bright: 'Bright',
  sell: 'Sell',
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  available: 'Available',
  pending: 'Pending',
  pending_review: 'Pending Review',
  pending_payment: 'Pending Payment',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Failed',
  paid: 'Paid',
  unpaid: 'Unpaid',
  refund_pending: 'Refund Pending',
  sold: 'Sold',
  hidden: 'Hidden',
  active: 'Active',
  inactive: 'Inactive',
  rejected: 'Rejected',
  suspended: 'Suspended',
  draft: 'Draft',
  approved: 'Approved',
  completed: 'Completed',
  none: 'None',
  SHOP: 'Shop',
  SELLER: 'Seller',
  PAYOS: 'PayOS',
  VNPAY: 'VNPay',
  WALLET: 'Wallet',
  newest: 'Newest',
  oldest: 'Oldest',
  price_asc: 'Price Low to High',
  price_desc: 'Price High to Low',
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
  constraints: {
    budgetMin: 1,
    maxItemsMin: 2,
    maxItemsMax: 10,
    maxItemsDefault: 5,
  },
})

export const getProductFilterOptions = () => ({
  listingTypes: toOptions(PRODUCT_LISTING_TYPES),
  conditions: toOptions(PRODUCT_CONDITIONS),
  statuses: toOptions(PRODUCT_STATUS_ENUM),
  ownerTypes: toOptions(PRODUCT_OWNER_TYPES),
  sortOptions: toOptions(['newest', 'oldest', 'price_asc', 'price_desc']),
})

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
