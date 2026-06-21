import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null)

const firstId = (...values) => values.map(toIdString).find(Boolean) || null

const encodeId = (value) => encodeURIComponent(toIdString(value) || '')

const isRelativeUrl = (value) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

const compactObject = (value = {}) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))

const orderTypes = new Set([
  NOTIFICATION_TYPES.ORDER_CREATED,
  NOTIFICATION_TYPES.ORDER_CONFIRMED,
  NOTIFICATION_TYPES.ORDER_REJECTED,
  NOTIFICATION_TYPES.ORDER_PREPARING,
  NOTIFICATION_TYPES.ORDER_SHIPPING,
  NOTIFICATION_TYPES.ORDER_DELIVERED,
  NOTIFICATION_TYPES.ORDER_CANCELLED_BY_BUYER,
  NOTIFICATION_TYPES.ORDER_CANCELLED_BY_SELLER,
  NOTIFICATION_TYPES.ORDER_REFUND_REQUESTED,
  NOTIFICATION_TYPES.ORDER_REFUND_APPROVED,
  NOTIFICATION_TYPES.ORDER_REFUND_REJECTED,
  NOTIFICATION_TYPES.ORDER_REVIEW_REQUIRED,
  NOTIFICATION_TYPES.PAYMENT_REFUNDED
])

const productTypes = new Set([
  NOTIFICATION_TYPES.PRODUCT_APPROVED,
  NOTIFICATION_TYPES.PRODUCT_REJECTED,
  NOTIFICATION_TYPES.PRODUCT_BLOCKED,
  NOTIFICATION_TYPES.PRODUCT_UNBLOCKED,
  NOTIFICATION_TYPES.PRODUCT_OUT_OF_STOCK,
  NOTIFICATION_TYPES.PRODUCT_LOW_STOCK,
  NOTIFICATION_TYPES.PRODUCT_REPORTED,
  NOTIFICATION_TYPES.PRODUCT_REVIEWED,
  NOTIFICATION_TYPES.PRODUCT_WISHLISTED,
  NOTIFICATION_TYPES.PRODUCT_PRICE_DROPPED
])

const shopTypes = new Set([
  NOTIFICATION_TYPES.SHOP_APPROVED,
  NOTIFICATION_TYPES.SHOP_REJECTED,
  NOTIFICATION_TYPES.SHOP_BLOCKED,
  NOTIFICATION_TYPES.SHOP_UNBLOCKED,
  NOTIFICATION_TYPES.SHOP_UPDATE_REQUIRED,
  NOTIFICATION_TYPES.SHOP_STAFF_INVITED,
  NOTIFICATION_TYPES.SHOP_STAFF_ACCEPTED,
  NOTIFICATION_TYPES.SHOP_STAFF_REMOVED,
  NOTIFICATION_TYPES.SHOP_OWNERSHIP_TRANSFERRED,
  NOTIFICATION_TYPES.SHOP_STAFF_ROLE_UPDATED
])

const kycTypes = new Set([
  NOTIFICATION_TYPES.KYC_SUBMITTED,
  NOTIFICATION_TYPES.KYC_APPROVED,
  NOTIFICATION_TYPES.KYC_REJECTED,
  NOTIFICATION_TYPES.KYC_UPDATE_REQUIRED
])

const paymentTypes = new Set([NOTIFICATION_TYPES.PAYMENT_SUCCESS, NOTIFICATION_TYPES.PAYMENT_FAILED])

const chatTypes = new Set([
  NOTIFICATION_TYPES.CHAT_NEW_MESSAGE,
  NOTIFICATION_TYPES.CHAT_NEW_IMAGE,
  NOTIFICATION_TYPES.CHAT_NEW_FILE,
  NOTIFICATION_TYPES.CHAT_CONVERSATION_CREATED,
  NOTIFICATION_TYPES.CHAT_REPORTED,
  NOTIFICATION_TYPES.CHAT_BLOCKED
])

const walletTypes = new Set([NOTIFICATION_TYPES.PAYOUT_RECEIVED])

const userTypes = new Set([
  NOTIFICATION_TYPES.SELLER_ROLE_GRANTED,
  NOTIFICATION_TYPES.SELLER_ROLE_REVOKED,
  NOTIFICATION_TYPES.USER_WARNED,
  NOTIFICATION_TYPES.USER_BLOCKED,
  NOTIFICATION_TYPES.USER_UNBLOCKED,
  NOTIFICATION_TYPES.SECURITY_PASSWORD_CHANGED,
  NOTIFICATION_TYPES.SECURITY_LOGIN_ALERT,
  NOTIFICATION_TYPES.EMAIL_VERIFIED
])

const reportTypes = new Set([NOTIFICATION_TYPES.REPORT_CREATED, NOTIFICATION_TYPES.REPORT_RESOLVED])

const reviewTypes = new Set([
  NOTIFICATION_TYPES.REVIEW_CREATED,
  NOTIFICATION_TYPES.REVIEW_REPLIED,
  NOTIFICATION_TYPES.REVIEW_HIDDEN,
  NOTIFICATION_TYPES.REVIEW_REPORTED
])

const voucherTypes = new Set([NOTIFICATION_TYPES.VOUCHER_CREATED, NOTIFICATION_TYPES.VOUCHER_EXPIRING])

const flashSaleTypes = new Set([NOTIFICATION_TYPES.FLASH_SALE_STARTED, NOTIFICATION_TYPES.FLASH_SALE_ENDING_SOON])

const comboTypes = new Set([NOTIFICATION_TYPES.COMBO_RECOMMENDED])
 
const exchangeTypes = new Set([
  NOTIFICATION_TYPES.EXCHANGE_OFFER_CREATED,
  NOTIFICATION_TYPES.EXCHANGE_COUNTERED,
  NOTIFICATION_TYPES.EXCHANGE_ACCEPTED,
  NOTIFICATION_TYPES.EXCHANGE_PAID,
  NOTIFICATION_TYPES.EXCHANGE_SHIPPED,
  NOTIFICATION_TYPES.EXCHANGE_COMPLETED,
  NOTIFICATION_TYPES.EXCHANGE_CANCELLED,
  NOTIFICATION_TYPES.EXCHANGE_DISPUTED,
  NOTIFICATION_TYPES.EXCHANGE_RESOLVED
])

const systemTypes = new Set([
  NOTIFICATION_TYPES.SYSTEM_MAINTENANCE,
  NOTIFICATION_TYPES.SYSTEM_POLICY_UPDATED,
  NOTIFICATION_TYPES.SYSTEM
])
 
const getExplicitRelativeUrl = (payload) => {
  const explicitTargetUrl = payload.targetUrl || payload.actionUrl
  return isRelativeUrl(explicitTargetUrl) ? explicitTargetUrl : null
}
 
export const buildNotificationTarget = (payload = {}) => {
  const metadata = compactObject({ ...(payload.data || {}), ...(payload.metadata || {}) })
  const explicitTargetUrl = getExplicitRelativeUrl(payload)
  const type = payload.type
 
  if (chatTypes.has(type)) {
    const conversationId = firstId(metadata.conversationId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.CHAT,
      targetId: conversationId,
      targetUrl: explicitTargetUrl || (conversationId ? `/chats/${encodeId(conversationId)}` : '/chats'),
      metadata: compactObject({ ...metadata, conversationId })
    }
  }

  if (exchangeTypes.has(type)) {
    const exchangeOfferId = firstId(metadata.exchangeOfferId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.EXCHANGE,
      targetId: exchangeOfferId,
      targetUrl: explicitTargetUrl || (exchangeOfferId ? `/seller/exchanges/${encodeId(exchangeOfferId)}` : '/seller/exchanges'),
      metadata: compactObject({ ...metadata, exchangeOfferId })
    }
  }

  if (orderTypes.has(type)) {
    const orderId = firstId(metadata.orderId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.ORDER,
      targetId: orderId,
      targetUrl: explicitTargetUrl || (orderId ? `/orders/${encodeId(orderId)}` : '/orders'),
      metadata: compactObject({ ...metadata, orderId })
    }
  }

  if (productTypes.has(type)) {
    const productId = firstId(metadata.productId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: productId,
      targetUrl: explicitTargetUrl || (productId ? `/products/${encodeId(productId)}` : '/products'),
      metadata: compactObject({ ...metadata, productId })
    }
  }

  if (shopTypes.has(type)) {
    const shopId = firstId(metadata.shopId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.SHOP,
      targetId: shopId,
      targetUrl: explicitTargetUrl || (shopId ? `/shops/${encodeId(shopId)}` : '/shops'),
      metadata: compactObject({ ...metadata, shopId })
    }
  }

  if (kycTypes.has(type)) {
    const userId = firstId(metadata.userId, payload.targetId, payload.recipient)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.KYC,
      targetId: userId,
      targetUrl: explicitTargetUrl || '/profile',
      metadata: compactObject({ ...metadata, userId })
    }
  }

  if (paymentTypes.has(type)) {
    const paymentId = firstId(metadata.paymentId, payload.targetId)
    const orderId = firstId(metadata.orderId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.PAYMENT,
      targetId: paymentId || orderId,
      targetUrl: explicitTargetUrl || (orderId ? `/orders/${encodeId(orderId)}` : '/payments'),
      metadata: compactObject({ ...metadata, paymentId, orderId })
    }
  }

  if (walletTypes.has(type)) {
    const walletId = firstId(metadata.walletId, payload.targetId)
    const withdrawalId = firstId(metadata.withdrawalId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.WALLET,
      targetId: withdrawalId || walletId,
      targetUrl: explicitTargetUrl || '/wallet',
      metadata: compactObject({ ...metadata, walletId, withdrawalId })
    }
  }

  if (userTypes.has(type)) {
    const userId = firstId(metadata.userId, payload.targetId, payload.recipient)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.USER,
      targetId: userId,
      targetUrl: explicitTargetUrl || '/profile',
      metadata: compactObject({ ...metadata, userId })
    }
  }

  if (reportTypes.has(type)) {
    const reportId = firstId(metadata.reportId, payload.targetId)
    const productId = firstId(metadata.productId)
    const shopId = firstId(metadata.shopId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.REPORT,
      targetId: reportId || productId || shopId,
      targetUrl:
        explicitTargetUrl ||
        (reportId
          ? `/reports/${encodeId(reportId)}`
          : productId
            ? `/products/${encodeId(productId)}`
            : shopId
              ? `/shops/${encodeId(shopId)}`
              : '/notifications'),
      metadata: compactObject({ ...metadata, reportId, productId, shopId })
    }
  }

  if (reviewTypes.has(type)) {
    const reviewId = firstId(metadata.reviewId, payload.targetId)
    const productId = firstId(metadata.productId)
    const orderId = firstId(metadata.orderId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.REVIEW,
      targetId: reviewId || productId || orderId,
      targetUrl:
        explicitTargetUrl ||
        (reviewId
          ? `/reviews/${encodeId(reviewId)}`
          : productId
            ? `/products/${encodeId(productId)}`
            : orderId
              ? `/orders/${encodeId(orderId)}`
              : '/notifications'),
      metadata: compactObject({ ...metadata, reviewId, productId, orderId })
    }
  }

  if (voucherTypes.has(type)) {
    const voucherId = firstId(metadata.voucherId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.VOUCHER,
      targetId: voucherId,
      targetUrl: explicitTargetUrl || (voucherId ? `/vouchers/${encodeId(voucherId)}` : '/vouchers'),
      metadata: compactObject({ ...metadata, voucherId })
    }
  }

  if (flashSaleTypes.has(type)) {
    const flashSaleId = firstId(metadata.flashSaleId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: flashSaleId,
      targetUrl: explicitTargetUrl || (flashSaleId ? `/flash-sales/${encodeId(flashSaleId)}` : '/flash-sales'),
      metadata: compactObject({ ...metadata, flashSaleId })
    }
  }

  if (comboTypes.has(type)) {
    const comboId = firstId(metadata.comboId, payload.targetId)
    return {
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: comboId,
      targetUrl: explicitTargetUrl || (comboId ? `/combos/${encodeId(comboId)}` : '/combos'),
      metadata: compactObject({ ...metadata, comboId })
    }
  }

  if (systemTypes.has(type)) {
    return {
      targetType: NOTIFICATION_TARGET_TYPES.NOTIFICATION,
      targetId: payload.targetId || null,
      targetUrl: explicitTargetUrl || '/notifications',
      metadata
    }
  }

  return {
    targetType: payload.targetType || NOTIFICATION_TARGET_TYPES.NOTIFICATION,
    targetId: payload.targetId || null,
    targetUrl: explicitTargetUrl || '/notifications',
    metadata
  }
}
