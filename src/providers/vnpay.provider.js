import crypto from 'crypto'
import { env } from '../configs/env.config.js'

const normalize = (payload = {}) => Object.fromEntries(
  Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)])
)

const signedEntries = (payload) => Object.entries(normalize(payload))
  .filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
  .sort(([left], [right]) => left.localeCompare(right))

const sign = (payload) => {
  const query = signedEntries(payload)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return crypto.createHmac('sha512', env.payment.vnpay.hashSecret)
    .update(Buffer.from(query, 'utf8'))
    .digest('hex')
}

const safeEqual = (left, right) => {
  if (!left || !right || left.length !== right.length) return false
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

const formatDate = (date) => new Date(date).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

const pipeSign = (values) => crypto.createHmac('sha512', env.payment.vnpay.hashSecret)
  .update(Buffer.from(values.join('|'), 'utf8'))
  .digest('hex')

export const vnpayProvider = {
  create({ merchantReference, amount, orderInfo, ipAddress, expiresAt }) {
    const createdDate = formatDate(new Date())
    const params = {
      vnp_Version: env.payment.vnpay.version,
      vnp_Command: env.payment.vnpay.command,
      vnp_TmnCode: env.payment.vnpay.tmnCode,
      vnp_Amount: String(Math.round(amount * 100)),
      vnp_CurrCode: env.payment.vnpay.currCode,
      vnp_TxnRef: merchantReference,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: env.payment.vnpay.orderType,
      vnp_Locale: env.payment.vnpay.locale,
      vnp_ReturnUrl: env.payment.vnpay.returnUrl,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_CreateDate: createdDate,
      vnp_ExpireDate: formatDate(expiresAt),
    }
    const query = new URLSearchParams(params)
    query.set('vnp_SecureHash', sign(params))
    return { url: `${env.payment.vnpay.paymentUrl}?${query.toString()}`, createdDate }
  },

  verifyCallback(payload) {
    const normalized = normalize(payload)
    const valid = safeEqual(sign(normalized), normalized.vnp_SecureHash)
    return { valid, payload: normalized }
  },

  transactionStatus(payload) {
    if (payload.vnp_ResponseCode === '00' && payload.vnp_TransactionStatus === '00') return 'succeeded'
    if (payload.vnp_ResponseCode === '24') return 'cancelled'
    return 'failed'
  },

  formatDate,
  async refund({ requestId, transactionType, merchantReference, amount, transactionNo, transactionDate, createBy, ipAddress }) {
    const payload = {
      vnp_RequestId: requestId,
      vnp_Version: env.payment.vnpay.version,
      vnp_Command: 'refund',
      vnp_TmnCode: env.payment.vnpay.tmnCode,
      vnp_TransactionType: transactionType,
      vnp_TxnRef: merchantReference,
      vnp_Amount: String(Math.round(amount * 100)),
      vnp_TransactionNo: transactionNo || '',
      vnp_TransactionDate: transactionDate,
      vnp_CreateBy: String(createBy),
      vnp_CreateDate: formatDate(new Date()),
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_OrderInfo: `Hoan tien giao dich ${merchantReference}`,
    }
    payload.vnp_SecureHash = pipeSign([
      payload.vnp_RequestId, payload.vnp_Version, payload.vnp_Command, payload.vnp_TmnCode,
      payload.vnp_TransactionType, payload.vnp_TxnRef, payload.vnp_Amount, payload.vnp_TransactionNo,
      payload.vnp_TransactionDate, payload.vnp_CreateBy, payload.vnp_CreateDate, payload.vnp_IpAddr,
      payload.vnp_OrderInfo,
    ])
    const response = await fetch(env.payment.vnpay.apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`VNPay refund HTTP ${response.status}`)
    return response.json()
  },
  refundCapability: 'api',
}
