const ERRORS = {
  // Auth
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_ALREADY_EXISTS: 'Email already in use',
    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'You do not have permission to perform this action',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Token is invalid',
    REFRESH_TOKEN_INVALID: 'Refresh token is invalid or expired',
    ACCOUNT_INACTIVE: 'Account has been deactivated',
    WRONG_PASSWORD: 'Current password is incorrect',
    RESET_TOKEN_INVALID: 'Reset password token is invalid or expired',
    VERIFY_EMAIL_TOKEN_INVALID: 'Email verification token is invalid or expired',
    GOOGLE_TOKEN_INVALID: 'Google token is invalid',
    GOOGLE_EMAIL_NOT_VERIFIED: 'Google email is not verified',
    GOOGLE_OAUTH_NOT_CONFIGURED: 'Google OAuth is not configured',
  },

  // Product
  PRODUCT: {
    NOT_FOUND: 'Product not found',
    NOT_OWNER: 'You are not the owner of this product',
    UNAVAILABLE: 'Product is not available',
    CANNOT_EXCHANGE_OWN: 'Cannot exchange your own product',
    ALREADY_SOLD: 'Product has already been sold or exchanged',
    INVALID_STATUS_TRANSITION: 'Invalid product status transition',
    IMAGE_NOT_FOUND: 'Product image not found',
  },

  // Exchange
  EXCHANGE: {
    NOT_FOUND: 'Exchange request not found',
    NOT_AUTHORIZED: 'You are not authorized to modify this exchange',
    ALREADY_RESPONDED: 'Exchange request has already been responded to',
    OFFERED_NOT_AVAILABLE: 'Your offered product is not available for exchange',
    DUPLICATE_REQUEST: 'An exchange request for this product already exists',
  },

  SHOP: {
    NOT_FOUND: 'Shop not found',
    SLUG_ALREADY_EXISTS: 'Shop slug already exists',
    INVALID_STAFF: 'Invalid shop staff',
  },

  ORDER: {
    NOT_FOUND: 'Order not found',
    PRODUCT_NOT_SELLABLE: 'Product is not sellable',
    PRODUCT_MISSING_SHOP: 'Product must be attached to a shop before ordering',
    SELF_ORDER_NOT_ALLOWED: 'Cannot create order for your own product',
    NOT_SHOP_ORDER: 'You are not allowed to process this order',
    INVALID_STATUS_TRANSITION: 'Invalid order status transition',
    NOT_READY_FOR_PAYMENT: 'Order is not ready for payment',
    ALREADY_PAID: 'Order has already been paid',
  },

  DELIVERY: {
    NOT_FOUND: 'Delivery not found',
    ORDER_NOT_READY: 'Order is not ready for delivery assignment',
    STAFF_NOT_FOUND: 'Delivery staff not found',
    NOT_ALLOWED_ASSIGN: 'You are not allowed to assign this delivery',
    NOT_ASSIGNED_STAFF: 'You are not assigned to this delivery',
    INVALID_STATUS_TRANSITION: 'Invalid delivery status transition',
  },

  PAYMENT: {
    NOT_FOUND: 'Payment not found',
    INVALID_SIGNATURE: 'Invalid VNPay signature',
    AMOUNT_MISMATCH: 'Payment amount does not match order amount',
    ORDER_NOT_ELIGIBLE: 'Order is not eligible for payment',
    ALREADY_PAID: 'Order has already been paid',
  },

  STATS: {
    SHOP_NOT_FOUND: 'Shop not found',
  },

  // Validation
  VALIDATION: {
    REQUIRED: 'This field is required',
    INVALID_FORMAT: 'Invalid format',
    INVALID_OBJECT_ID: 'Invalid ID format',
    PAGE_MUST_BE_NUMBER: 'Page must be a positive integer',
    LIMIT_OUT_OF_RANGE: 'Limit must be between 1 and 100',
  },

  // General
  GENERAL: {
    INTERNAL_SERVER: 'Internal server error',
    NOT_FOUND: 'Resource not found',
    TOO_MANY_REQUESTS: 'Too many requests, please try again later',
  },

  RBAC: {
    ROLE_NOT_FOUND: 'Role not found',
    ROLE_REQUIRED: 'At least one role is required',
    PERMISSION_NOT_FOUND: 'Permission not found',
  },
};

export default ERRORS;
