/**
 * Các trạng thái (statuses) trong hệ thống
 */

// Trạng thái shop (onboarding workflow)
export const SHOP_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
}

export const SHOP_STATUS_ENUM = Object.values(SHOP_STATUS)

// Trạng thái sản phẩm
export const PRODUCT_STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  SOLD: 'sold',
  HIDDEN: 'hidden',
}

export const PRODUCT_STATUS_ENUM = Object.values(PRODUCT_STATUS)

export const PRODUCT_STATUS_DESCRIPTIONS = {
  [PRODUCT_STATUS.AVAILABLE]: 'Sản phẩm đang bán',
  [PRODUCT_STATUS.PENDING]: 'Sản phẩm đang chờ xử lý',
  [PRODUCT_STATUS.SOLD]: 'Sản phẩm đã bán',
  [PRODUCT_STATUS.HIDDEN]: 'Sản phẩm bị ẩn',
}

// Trạng thái đơn hàng
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
}

export const ORDER_STATUS_ENUM = Object.values(ORDER_STATUS)

// Trạng thái thanh toán
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUND_PENDING: 'refund_pending',
}

export const PAYMENT_STATUS_ENUM = Object.values(PAYMENT_STATUS)

export const FEE_POLICY_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
}

export const FEE_POLICY_STATUS_ENUM = Object.values(FEE_POLICY_STATUS)

export const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  HELD: 'held',
  SETTLED: 'settled',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
}

export const SETTLEMENT_STATUS_ENUM = Object.values(SETTLEMENT_STATUS)

export const EXCHANGE_STATUS = {
  DRAFT: 'draft',
  PENDING_ACCEPTANCE: 'pending_acceptance',
  ACCEPTED: 'accepted',
  PAID: 'paid',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
}

export const EXCHANGE_STATUS_ENUM = Object.values(EXCHANGE_STATUS)

export const RENTAL_BOOKING_STATUS = {
  PENDING: 'pending',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  READY_FOR_HANDOVER: 'ready_for_handover',
  IN_RENTAL: 'in_rental',
  RETURN_PENDING_CONFIRMATION: 'return_pending_confirmation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
  DISPUTED: 'disputed',
}

export const RENTAL_BOOKING_STATUS_ENUM = Object.values(RENTAL_BOOKING_STATUS)

export const RENTAL_CLAIM_STATUS = {
  OPEN: 'open',
  WAITING_RENTER_RESPONSE: 'waiting_renter_response',
  UNDER_ADMIN_REVIEW: 'under_admin_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PARTIALLY_APPROVED: 'partially_approved',
  CLOSED: 'closed',
}

export const RENTAL_CLAIM_STATUS_ENUM = Object.values(RENTAL_CLAIM_STATUS)

// Trạng thái lời mời tham gia shop
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
}

export const INVITATION_STATUS_ENUM = Object.values(INVITATION_STATUS)

// Trạng thái thành viên shop
export const SHOP_MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
}

export const SHOP_MEMBER_STATUS_ENUM = Object.values(SHOP_MEMBER_STATUS)

// Trạng thái giao dịch ví
export const WALLET_TRANSACTION_TYPE = {
  CREDIT: 'credit',
  DEBIT: 'debit',
}

export const WALLET_TRANSACTION_TYPE_ENUM = Object.values(WALLET_TRANSACTION_TYPE)

export const WALLET_TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

export const WALLET_TRANSACTION_STATUS_ENUM = Object.values(WALLET_TRANSACTION_STATUS)

// Loại giao dịch ví cá nhân user
export const USER_WALLET_TRANSACTION_TYPE = {
  TOPUP: 'topup',
  PAYMENT: 'payment',
  REFUND: 'refund',
  WITHDRAWAL: 'withdrawal',
  EXCHANGE_PAYMENT: 'exchange_payment',
  EXCHANGE_SETTLEMENT: 'exchange_settlement',
  EXCHANGE_REFUND: 'exchange_refund',
  RENTAL_PAYMENT: 'rental_payment',
  RENTAL_ADDITIONAL_RENT: 'rental_additional_rent',
  RENTAL_UNUSED_REFUND: 'rental_unused_refund',
  RENTAL_OWNER_SETTLEMENT: 'rental_owner_settlement',
  RENTAL_DEPOSIT_RELEASE: 'rental_deposit_release',
  RENTAL_LATE_FEE: 'rental_late_fee',
  RENTAL_CLAIM_DEDUCTION: 'rental_claim_deduction',
}

export const USER_WALLET_TRANSACTION_TYPE_ENUM = Object.values(USER_WALLET_TRANSACTION_TYPE)

// Trạng thái phiên nạp tiền
export const TOPUP_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export const TOPUP_STATUS_ENUM = Object.values(TOPUP_STATUS)

// Trạng thái lệnh rút tiền
export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
}

export const WITHDRAWAL_STATUS_ENUM = Object.values(WITHDRAWAL_STATUS)

export default {
  SHOP_STATUS,
  SHOP_STATUS_ENUM,
  PRODUCT_STATUS,
  PRODUCT_STATUS_ENUM,
  PRODUCT_STATUS_DESCRIPTIONS,
  ORDER_STATUS,
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS,
  PAYMENT_STATUS_ENUM,
  FEE_POLICY_STATUS,
  FEE_POLICY_STATUS_ENUM,
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_ENUM,
  EXCHANGE_STATUS,
  EXCHANGE_STATUS_ENUM,
  RENTAL_BOOKING_STATUS,
  RENTAL_BOOKING_STATUS_ENUM,
  RENTAL_CLAIM_STATUS,
  RENTAL_CLAIM_STATUS_ENUM,
  INVITATION_STATUS,
  INVITATION_STATUS_ENUM,
  SHOP_MEMBER_STATUS,
  SHOP_MEMBER_STATUS_ENUM,
  WALLET_TRANSACTION_TYPE,
  WALLET_TRANSACTION_TYPE_ENUM,
  WALLET_TRANSACTION_STATUS,
  WALLET_TRANSACTION_STATUS_ENUM,
  USER_WALLET_TRANSACTION_TYPE,
  USER_WALLET_TRANSACTION_TYPE_ENUM,
  TOPUP_STATUS,
  TOPUP_STATUS_ENUM,
  WITHDRAWAL_STATUS,
  WITHDRAWAL_STATUS_ENUM,
}
