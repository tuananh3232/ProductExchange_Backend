/**
 * Các trạng thái (statuses) trong hệ thống
 */

// Trạng thái sản phẩm
export const PRODUCT_STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  SOLD: 'sold',
  EXCHANGED: 'exchanged',
  HIDDEN: 'hidden',
};

export const PRODUCT_STATUS_ENUM = Object.values(PRODUCT_STATUS);

export const PRODUCT_STATUS_DESCRIPTIONS = {
  [PRODUCT_STATUS.AVAILABLE]: 'Sản phẩm đang bán',
  [PRODUCT_STATUS.PENDING]: 'Sản phẩm đang chờ xử lý',
  [PRODUCT_STATUS.SOLD]: 'Sản phẩm đã bán',
  [PRODUCT_STATUS.EXCHANGED]: 'Sản phẩm đã trao đổi',
  [PRODUCT_STATUS.HIDDEN]: 'Sản phẩm bị ẩn',
};

// Trạng thái đề xuất trao đổi
export const EXCHANGE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

export const EXCHANGE_STATUS_ENUM = Object.values(EXCHANGE_STATUS);

export const EXCHANGE_STATUS_DESCRIPTIONS = {
  [EXCHANGE_STATUS.PENDING]: 'Đề xuất đang chờ xử lý',
  [EXCHANGE_STATUS.ACCEPTED]: 'Đề xuất đã chấp nhận',
  [EXCHANGE_STATUS.REJECTED]: 'Đề xuất bị từ chối',
  [EXCHANGE_STATUS.CANCELLED]: 'Đề xuất bị hủy',
  [EXCHANGE_STATUS.COMPLETED]: 'Trao đổi hoàn tất',
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

// Trạng thái giao hàng
export const DELIVERY_STATUS = {
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

export const DELIVERY_STATUS_ENUM = Object.values(DELIVERY_STATUS);

export default {
  PRODUCT_STATUS,
  PRODUCT_STATUS_ENUM,
  EXCHANGE_STATUS,
  EXCHANGE_STATUS_ENUM,
  ORDER_STATUS,
  ORDER_STATUS_ENUM,
  PAYMENT_STATUS,
  PAYMENT_STATUS_ENUM,
  DELIVERY_STATUS,
  DELIVERY_STATUS_ENUM,
};
