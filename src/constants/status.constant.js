/**
 * Các trạng thái (statuses) trong hệ thống
 */

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
};

export const PAYMENT_STATUS_ENUM = Object.values(PAYMENT_STATUS);

export default {
  PRODUCT_STATUS,
  PRODUCT_STATUS_ENUM,
  PRODUCT_STATUS_DESCRIPTIONS,
  ORDER_STATUS,
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS,
  PAYMENT_STATUS_ENUM,
};
