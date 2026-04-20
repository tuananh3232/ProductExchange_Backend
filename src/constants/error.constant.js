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
  },

  // Product
  PRODUCT: {
    NOT_FOUND: 'Product not found',
    NOT_OWNER: 'You are not the owner of this product',
    UNAVAILABLE: 'Product is not available',
    CANNOT_EXCHANGE_OWN: 'Cannot exchange your own product',
    ALREADY_SOLD: 'Product has already been sold or exchanged',
  },

  // Exchange
  EXCHANGE: {
    NOT_FOUND: 'Exchange request not found',
    NOT_AUTHORIZED: 'You are not authorized to modify this exchange',
    ALREADY_RESPONDED: 'Exchange request has already been responded to',
    OFFERED_NOT_AVAILABLE: 'Your offered product is not available for exchange',
    DUPLICATE_REQUEST: 'An exchange request for this product already exists',
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
};

export default ERRORS;
