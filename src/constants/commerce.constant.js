export const CHECKOUT_STATUS = {
  CREATED: 'created',
  PAYMENT_PENDING: 'payment_pending',
  PAID: 'paid',
  EXPIRED: 'expired',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export const CHECKOUT_STATUS_ENUM = Object.values(CHECKOUT_STATUS)

export const COMMERCE_ORDER_STATUS = {
  PAYMENT_PENDING: 'payment_pending',
  PAID_HELD: 'paid_held',
  SELLER_CONFIRMED: 'seller_confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED_PENDING_CONFIRMATION: 'delivered_pending_confirmation',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  RETURN_REQUESTED: 'return_requested',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
}

export const COMMERCE_ORDER_STATUS_ENUM = Object.values(COMMERCE_ORDER_STATUS)

export const PAYMENT_ATTEMPT_STATUS = {
  CREATED: 'created',
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

export const PAYMENT_ATTEMPT_STATUS_ENUM = Object.values(PAYMENT_ATTEMPT_STATUS)
export const PAYMENT_ATTEMPT_TERMINAL_STATUSES = [
  PAYMENT_ATTEMPT_STATUS.SUCCEEDED,
  PAYMENT_ATTEMPT_STATUS.FAILED,
  PAYMENT_ATTEMPT_STATUS.CANCELLED,
  PAYMENT_ATTEMPT_STATUS.EXPIRED,
]

export const RESERVATION_STATUS = {
  ACTIVE: 'active',
  CONSUMED: 'consumed',
  RELEASED: 'released',
  EXPIRED: 'expired',
}

export const RESERVATION_STATUS_ENUM = Object.values(RESERVATION_STATUS)

export const REFUND_STATUS = {
  REQUESTED: 'requested',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  MANUAL_REQUIRED: 'manual_required',
}

export const REFUND_STATUS_ENUM = Object.values(REFUND_STATUS)
