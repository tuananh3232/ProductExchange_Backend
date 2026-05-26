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
};

export const SHOP_STATUS_ENUM = Object.values(SHOP_STATUS);

// Trạng thái sản phẩm
export const PRODUCT_STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  SOLD: 'sold',
  HIDDEN: 'hidden',
};

export const PRODUCT_STATUS_ENUM = Object.values(PRODUCT_STATUS);

export const PRODUCT_STATUS_DESCRIPTIONS = {
  [PRODUCT_STATUS.AVAILABLE]: 'Sản phẩm đang bán',
  [PRODUCT_STATUS.PENDING]: 'Sản phẩm đang chờ xử lý',
  [PRODUCT_STATUS.SOLD]: 'Sản phẩm đã bán',
  [PRODUCT_STATUS.HIDDEN]: 'Sản phẩm bị ẩn',
};

// Trạng thái đơn hàng
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const ORDER_STATUS_ENUM = Object.values(ORDER_STATUS);

// Trạng thái thanh toán
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUND_PENDING: 'refund_pending',
};

export const PAYMENT_STATUS_ENUM = Object.values(PAYMENT_STATUS);

// Trạng thái lời mời tham gia shop
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

export const INVITATION_STATUS_ENUM = Object.values(INVITATION_STATUS);

// Trạng thái thành viên shop
export const SHOP_MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const SHOP_MEMBER_STATUS_ENUM = Object.values(SHOP_MEMBER_STATUS);

// Trạng thái giao dịch ví
export const WALLET_TRANSACTION_TYPE = {
  CREDIT: 'credit',
  DEBIT: 'debit',
};

export const WALLET_TRANSACTION_TYPE_ENUM = Object.values(WALLET_TRANSACTION_TYPE);

export const WALLET_TRANSACTION_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const WALLET_TRANSACTION_STATUS_ENUM = Object.values(WALLET_TRANSACTION_STATUS);

// Loại giao dịch ví cá nhân user
export const USER_WALLET_TRANSACTION_TYPE = {
  TOPUP: 'topup',
  PAYMENT: 'payment',
  REFUND: 'refund',
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
};

export const WITHDRAWAL_STATUS_ENUM = Object.values(WITHDRAWAL_STATUS);

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
};
