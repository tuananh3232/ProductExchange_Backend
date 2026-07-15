import dotenv from 'dotenv'
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET']
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction) {
  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  })
}

const apiPrefix = process.env.API_PREFIX || '/api/v1'
const appUrl = process.env.APP_URL || 'http://localhost:3000'
const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || appUrl
const normalizeSecret = (value) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value)
const dbName = process.env.DB_NAME || 'anhdecor'
const booleanEnv = (key, fallback = false) => {
  const value = process.env[key]
  if (value === undefined || value === '') return fallback
  return value === 'true'
}
const enableFeaturesInTest = process.env.NODE_ENV === 'test'

const normalizeMongoUri = (uri, databaseName) => {
  if (!uri) return uri

  try {
    const url = new URL(uri)
    const currentPath = url.pathname.replace(/^\/+/, '')

    if (!currentPath || currentPath === 'test') {
      url.pathname = `/${databaseName}`
    }

    return url.toString()
  } catch {
    if (uri.endsWith('/test')) {
      return `${uri.slice(0, -5)}/${databaseName}`
    }

    if (uri.endsWith('/')) {
      return `${uri}${databaseName}`
    }

    return uri
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix,
  appUrl,
  frontendUrl,
  commerce: {
    confirmationWindowHours: parseInt(process.env.ORDER_CONFIRMATION_WINDOW_HOURS, 10) || 72,
    caseWindowHours: parseInt(process.env.ORDER_CASE_WINDOW_HOURS, 10) || 168,
  },
  dataRetention: {
    rejectedKycDays: parseInt(process.env.KYC_REJECTED_RETENTION_DAYS, 10) || 30,
  },
  staffInvitation: {
    path: process.env.STAFF_INVITATION_PATH || '/shop/invitations',
    urlTemplate: process.env.STAFF_INVITATION_URL_TEMPLATE || '',
  },

  mongodb: {
    uri: normalizeMongoUri(process.env.MONGODB_URI, dbName),
    dbName,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  mail: {
    host: process.env.SMTP_HOST || process.env.MAIL_HOST,
    port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT, 10) || 587,
    secure: (process.env.SMTP_SECURE || process.env.MAIL_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || process.env.MAIL_USER,
    password: normalizeSecret(process.env.SMTP_PASS || process.env.MAIL_PASS),
    from: process.env.SMTP_FROM || process.env.MAIL_FROM,
    fromName: process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'ProductExchange',
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(','),
  },

  features: {
    commerce: booleanEnv('COMMERCE_ENABLED', enableFeaturesInTest),
    payosPayments: booleanEnv('PAYOS_PAYMENTS_ENABLED', enableFeaturesInTest),
    vnpayPayments: booleanEnv('VNPAY_PAYMENTS_ENABLED', enableFeaturesInTest),
    walletPayments: booleanEnv('WALLET_PAYMENTS_ENABLED', enableFeaturesInTest),
    withdrawals: booleanEnv('WITHDRAWALS_ENABLED', enableFeaturesInTest),
    exchange: booleanEnv('EXCHANGE_ENABLED', enableFeaturesInTest),
    rental: booleanEnv('RENTAL_ENABLED', enableFeaturesInTest),
    subscriptionPayment: booleanEnv('SUBSCRIPTION_PAYMENT_ENABLED', enableFeaturesInTest),
    roomVisualizer: booleanEnv('ROOM_VISUALIZER_ENABLED', enableFeaturesInTest),
    requireMongoTransactions: booleanEnv('REQUIRE_MONGO_TRANSACTIONS', isProduction),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '641059424347-am57p7hj73g21n2sutp1n7q4b80ucd77.apps.googleusercontent.com',
  },

  payment: {
    vnpay: {
      paymentUrl: process.env.VNPAY_PAYMENT_URL || process.env.VNPAY_SANDBOX_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      tmnCode: process.env.VNPAY_TMN_CODE || 'DEMO',
      hashSecret: process.env.VNPAY_HASH_SECRET || 'DEMO_HASH_SECRET',
      version: process.env.VNPAY_VERSION || '2.1.0',
      command: process.env.VNPAY_COMMAND || 'pay',
      currCode: process.env.VNPAY_CURR_CODE || 'VND',
      locale: process.env.VNPAY_LOCALE || 'vn',
      orderType: process.env.VNPAY_ORDER_TYPE || 'other',
      returnUrl: process.env.VNPAY_RETURN_URL || `${appUrl}${apiPrefix}/payments/vnpay/return`,
      ipnUrl: process.env.VNPAY_IPN_URL || `${appUrl}${apiPrefix}/payments/vnpay/ipn`,
      apiUrl: process.env.VNPAY_API_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    },
    payos: {
      clientId: process.env.PAYOS_CLIENT_ID || '',
      apiKey: process.env.PAYOS_API_KEY || '',
      checksumKey: process.env.PAYOS_CHECKSUM_KEY || '',
      returnUrl: process.env.PAYOS_RETURN_URL || `${appUrl}${apiPrefix}/payments/payos/return`,
      cancelUrl: process.env.PAYOS_CANCEL_URL || `${appUrl}${apiPrefix}/payments/payos/cancel`,
      topupReturnUrl: process.env.PAYOS_TOPUP_RETURN_URL || `${appUrl}${apiPrefix}/payments/payos/topup/return`,
      topupCancelUrl: process.env.PAYOS_TOPUP_CANCEL_URL || `${appUrl}${apiPrefix}/payments/payos/topup/cancel`,
      subReturnUrl: process.env.PAYOS_SUB_RETURN_URL || `${appUrl}${apiPrefix}/subscriptions/payos/return`,
      subCancelUrl: process.env.PAYOS_SUB_CANCEL_URL || `${appUrl}${apiPrefix}/subscriptions/payos/cancel`,
    },
  },
}

const assertConfiguredFeature = (enabled, keys, featureName) => {
  if (!enabled) return
  const missing = keys.filter((key) => !process.env[key])
  if (missing.length) {
    throw new Error(`${featureName} is enabled but missing environment variables: ${missing.join(', ')}`)
  }
}

if (isProduction) {
  if (!env.cors.allowedOrigins.map((value) => value.trim()).filter(Boolean).length) {
    throw new Error('ALLOWED_ORIGINS is required in production')
  }
  assertConfiguredFeature(env.features.payosPayments || env.features.subscriptionPayment, ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'], 'PayOS')
  assertConfiguredFeature(env.features.vnpayPayments, ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'], 'VNPay')
}
