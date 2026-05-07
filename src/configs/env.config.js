import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  requiredEnvVars.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

const apiPrefix = process.env.API_PREFIX || '/api/v1';
const appUrl = process.env.APP_URL || 'http://localhost:3000';
const normalizeSecret = (value) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix,

  mongodb: {
    uri: process.env.MONGODB_URI,
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
    },
  },
};
