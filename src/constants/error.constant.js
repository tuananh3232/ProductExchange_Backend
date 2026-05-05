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
    ALREADY_SOLD: 'Product has already been sold',
    INVALID_STATUS_TRANSITION: 'Invalid product status transition',
    IMAGE_NOT_FOUND: 'Product image not found',
  },

  SHOP: {
    NOT_FOUND: 'Shop not found',
    SLUG_ALREADY_EXISTS: 'Shop slug already exists',
    INVALID_STAFF: 'Invalid shop staff',
    NOT_DRAFT: 'Shop is not in draft status',
    NOT_PENDING: 'Shop is not pending review',
    NOT_ACTIVE: 'Shop is not active',
    NOT_REJECTED: 'Shop is not in rejected status',
    ALREADY_ACTIVE: 'Shop is already active',
    SUSPENDED: 'Shop has been suspended',
    INCOMPLETE_ONBOARDING: 'Shop profile is incomplete. Please fill in name, phone, email, and address before submitting',
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

  KYC: {
    NOT_SUBMITTED: 'KYC has not been submitted',
    NOT_APPROVED: 'KYC has not been approved',
    NOT_PENDING: 'KYC is not in pending status',
    ALREADY_APPROVED: 'KYC has already been approved',
    IMAGE_REQUIRED: 'Front and back CCCD images are required',
  },

  RBAC: {
    ROLE_NOT_FOUND: 'Role not found',
    ROLE_REQUIRED: 'At least one role is required',
    PERMISSION_NOT_FOUND: 'Permission not found',
  },
};

export default ERRORS;
