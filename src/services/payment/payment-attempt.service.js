import crypto from 'crypto'
import Checkout from '../../models/checkout.model.js'
import Counter from '../../models/counter.model.js'
import InventoryReservation from '../../models/inventory-reservation.model.js'
import Order from '../../models/order.model.js'
import PaymentAttempt from '../../models/payment-attempt.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { env } from '../../configs/env.config.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { CHECKOUT_STATUS, COMMERCE_ORDER_STATUS, PAYMENT_ATTEMPT_STATUS } from '../../constants/commerce.constant.js'
import { PAYMENT_STATUS } from '../../constants/status.constant.js'
import { consumeReservation, releaseReservation } from '../inventory/inventory.service.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'
import { payosProvider } from '../../providers/payos.provider.js'
import { vnpayProvider } from '../../providers/vnpay.provider.js'
import FeePolicy from '../../models/fee-policy.model.js'
import FeeSnapshot from '../../models/fee-snapshot.model.js'
import Product from '../../models/product.model.js'
import { normalizeFeePreview, selectApplicablePolicy } from '../fee-policy/fee-policy.service.js'
import { runIdempotentCommand } from '../../utils/idempotency-command.util.js'

const hashPayload = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

const snapshotOrderFees = async (orderIds, session) => {
  const orders = await Order.find({ _id: { $in: orderIds } }).session(session)
  const productIds = orders.map((order) => order.product).filter(Boolean)
  const products = await Product.find({ _id: { $in: productIds } }).select('category').session(session).lean()
  const categoryByProduct = new Map(products.map((product) => [String(product._id), product.category]))
  const policies = await FeePolicy.find({ transactionType: 'SALE', status: 'active' }).session(session).lean()
  for (const order of orders) {
    if (order.feeSnapshotId) continue
    const ownerType = order.shop ? 'SHOP' : 'SELLER'
    const baseAmount = Number(order.amountBreakdown?.total || order.totalAmount)
    const categoryId = categoryByProduct.get(String(order.product)) || null
    const policy = selectApplicablePolicy(policies, {
      transactionType: 'SALE',
      ownerType,
      categoryId,
      baseAmount,
      transactionCreatedAt: new Date(),
    })
    const percent = policy ? Number(policy.percent) : 5
    const calculated = policy
      ? normalizeFeePreview(policy, baseAmount)
      : { baseAmount, calculatedFee: Math.round(baseAmount * percent / 100), netAmount: Math.round(baseAmount * (100 - percent) / 100) }
    const [snapshot] = await FeeSnapshot.create([{
      sourceType: 'order',
      sourceId: order._id,
      feePolicyId: policy?._id || null,
      transactionType: 'SALE',
      ownerType,
      categoryId,
      baseAmountType: policy?.baseAmountType || 'SALE_PRICE',
      rounding: policy?.rounding || 'ROUND',
      baseAmount,
      percent,
      fixedFee: policy?.fixedFee || 0,
      minFee: policy?.minFee || 0,
      maxFee: policy?.maxFee ?? null,
      calculatedFee: calculated.calculatedFee,
      netAmount: calculated.netAmount,
      effectiveFrom: new Date(),
      effectiveTo: policy?.effectiveTo || null,
      lockedAt: new Date(),
    }], { session })
    order.totalPlatformFee = calculated.calculatedFee
    order.netSettlementAmount = calculated.netAmount
    order.feeSnapshotId = snapshot._id
    order.feePolicyId = policy?._id || null
    await order.save({ session })
  }
}

const nextPayosOrderCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'payos_order_code_v1' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
  const value = counter.value
  if (value > 999999999) throw new AppError('Đã hết dải mã giao dịch PayOS', HTTP_STATUS.SERVICE_UNAVAILABLE, 'PAYOS_SEQUENCE_EXHAUSTED')
  return value
}

const requireCheckout = async (checkoutId, buyerId) => {
  const checkout = await Checkout.findOne({ _id: checkoutId, buyer: buyerId })
  if (!checkout) throw new AppError('Không tìm thấy checkout', HTTP_STATUS.NOT_FOUND, 'CHECKOUT_NOT_FOUND')
  if (checkout.expiresAt <= new Date()) throw new AppError('Checkout đã hết hạn', HTTP_STATUS.CONFLICT, 'CHECKOUT_EXPIRED')
  if (checkout.status === CHECKOUT_STATUS.PAID) throw new AppError('Checkout đã thanh toán', HTTP_STATUS.CONFLICT, 'CHECKOUT_ALREADY_PAID')
  return checkout
}

const markPaymentSucceeded = async (attemptId, providerReference, payload, source) => runRequiredMongoTransaction(async (session) => {
  const attempt = await PaymentAttempt.findById(attemptId).session(session)
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  if (attempt.status === PAYMENT_ATTEMPT_STATUS.SUCCEEDED) return attempt
  if ([PAYMENT_ATTEMPT_STATUS.CANCELLED, PAYMENT_ATTEMPT_STATUS.EXPIRED].includes(attempt.status)) {
    throw new AppError('Giao dịch đã ở trạng thái kết thúc', HTTP_STATUS.CONFLICT, 'PAYMENT_ATTEMPT_TERMINAL')
  }

  const checkout = await Checkout.findById(attempt.checkout).session(session)
  if (!checkout || checkout.status === CHECKOUT_STATUS.PAID) {
    throw new AppError('Trạng thái checkout không hợp lệ', HTTP_STATUS.CONFLICT, 'CHECKOUT_STATE_CONFLICT')
  }

  const reservations = await InventoryReservation.find({ checkout: checkout._id }).session(session)
  for (const reservation of reservations) await consumeReservation(reservation._id, session)
  await snapshotOrderFees(attempt.orders, session)

  await postBalancedTransaction({
    commandKey: `payment_capture:${attempt._id}`,
    transactionType: 'payment_capture',
    referenceType: 'PaymentAttempt',
    referenceId: attempt._id,
    description: `Ghi nhận thanh toán ${source}`,
    entries: [
      { account: accountDefinitions.providerClearing(attempt.provider), direction: 'debit', amount: attempt.amount },
      { account: accountDefinitions.orderEscrow(checkout._id), direction: 'credit', amount: attempt.amount },
    ],
  }, session)

  attempt.status = PAYMENT_ATTEMPT_STATUS.SUCCEEDED
  attempt.providerReference = providerReference || attempt.providerReference
  attempt.paidAt = new Date()
  attempt.reconciliationState = 'matched'
  attempt.callbackHistory.push({ payloadHash: hashPayload(payload), verifiedAt: new Date(), providerStatus: 'succeeded' })
  await attempt.save({ session })
  await Checkout.updateOne({ _id: checkout._id }, { status: CHECKOUT_STATUS.PAID }, { session })
  await Order.updateMany(
    { _id: { $in: attempt.orders } },
    {
      commerceStatus: COMMERCE_ORDER_STATUS.PAID_HELD,
      paymentStatus: PAYMENT_STATUS.PAID,
      paymentMethod: attempt.method,
      paymentProvider: attempt.provider,
      paymentRef: attempt.merchantReference,
      paidAt: new Date(),
    },
    { session }
  )
  return attempt
})

const createPaymentAttemptCommand = async ({ checkoutId, buyerId, provider, idempotencyKey, clientIp }) => {
  const existing = await PaymentAttempt.findOne({ buyer: buyerId, idempotencyKey })
  if (existing) return existing
  const checkout = await requireCheckout(checkoutId, buyerId)
  if (!['payos', 'vnpay', 'wallet'].includes(provider)) {
    throw new AppError('Cổng thanh toán chưa được hỗ trợ trong phase này', HTTP_STATUS.BAD_REQUEST, 'PROVIDER_NOT_AVAILABLE')
  }
  if (provider === 'payos' && !env.features.payosPayments) {
    throw new AppError('Thanh toán PayOS đang tắt', HTTP_STATUS.SERVICE_UNAVAILABLE, 'FEATURE_DISABLED')
  }
  if (provider === 'wallet' && !env.features.walletPayments) {
    throw new AppError('Thanh toán ví đang tắt', HTTP_STATUS.SERVICE_UNAVAILABLE, 'FEATURE_DISABLED')
  }
  if (provider === 'vnpay' && !env.features.vnpayPayments) {
    throw new AppError('Thanh toán VNPay đang tắt', HTTP_STATUS.SERVICE_UNAVAILABLE, 'FEATURE_DISABLED')
  }

  if (provider === 'wallet') {
    return runRequiredMongoTransaction(async (session) => {
      const [attempt] = await PaymentAttempt.create([{
        checkout: checkout._id,
        orders: checkout.orders,
        buyer: buyerId,
        provider,
        method: 'wallet',
        amount: checkout.amount.total,
        idempotencyKey,
        merchantReference: `WALLET-${checkout._id}-${idempotencyKey}`,
        status: PAYMENT_ATTEMPT_STATUS.PENDING,
      }], { session })
      const wallet = await UserWallet.findOneAndUpdate(
        { user: buyerId, isActive: true, balance: { $gte: checkout.amount.total } },
        { $inc: { balance: -checkout.amount.total, totalSpent: checkout.amount.total } },
        { returnDocument: 'after', session }
      )
      if (!wallet) throw new AppError('Số dư ví không đủ', HTTP_STATUS.CONFLICT, 'INSUFFICIENT_WALLET_BALANCE')

      const reservations = await InventoryReservation.find({ checkout: checkout._id }).session(session)
      for (const reservation of reservations) await consumeReservation(reservation._id, session)
      await snapshotOrderFees(attempt.orders, session)
      await postBalancedTransaction({
        commandKey: `payment_capture:${attempt._id}`,
        transactionType: 'wallet_payment_capture',
        referenceType: 'PaymentAttempt',
        referenceId: attempt._id,
        entries: [
          { account: accountDefinitions.userWallet(buyerId), direction: 'debit', amount: attempt.amount },
          { account: accountDefinitions.orderEscrow(checkout._id), direction: 'credit', amount: attempt.amount },
        ],
      }, session)
      attempt.status = PAYMENT_ATTEMPT_STATUS.SUCCEEDED
      attempt.paidAt = new Date()
      attempt.reconciliationState = 'matched'
      await attempt.save({ session })
      await Checkout.updateOne({ _id: checkout._id }, { status: CHECKOUT_STATUS.PAID }, { session })
      await Order.updateMany({ _id: { $in: checkout.orders } }, {
        commerceStatus: COMMERCE_ORDER_STATUS.PAID_HELD,
        paymentStatus: PAYMENT_STATUS.PAID,
        paymentMethod: 'wallet',
        paymentProvider: 'wallet',
        paymentRef: attempt.merchantReference,
        paidAt: new Date(),
      }, { session })
      return attempt
    })
  }

  if (provider === 'vnpay') {
    const reference = `VNPAY-${checkout._id}-${crypto.randomBytes(6).toString('hex')}`
    const attempt = await PaymentAttempt.create({
      checkout: checkout._id,
      orders: checkout.orders,
      buyer: buyerId,
      provider,
      method: 'vnpay',
      amount: checkout.amount.total,
      idempotencyKey,
      merchantReference: reference,
      status: PAYMENT_ATTEMPT_STATUS.PENDING,
    })
    const paymentRequest = vnpayProvider.create({
      merchantReference: reference,
      amount: attempt.amount,
      orderInfo: `Thanh toan checkout ${checkout._id}`,
      ipAddress: clientIp,
      expiresAt: checkout.expiresAt,
    })
    attempt.checkoutUrl = paymentRequest.url
    attempt.providerCreatedAt = paymentRequest.createdDate
    await attempt.save()
    return attempt
  }

  const orderCode = await nextPayosOrderCode()
  const attempt = await PaymentAttempt.create({
    checkout: checkout._id,
    orders: checkout.orders,
    buyer: buyerId,
    provider,
    method: 'payos',
    amount: checkout.amount.total,
    idempotencyKey,
    merchantReference: `PAYOS-${orderCode}`,
    providerOrderCode: orderCode,
    status: PAYMENT_ATTEMPT_STATUS.CREATED,
  })
  try {
    const link = await payosProvider.create({
      orderCode,
      amount: checkout.amount.total,
      description: `Checkout ${String(checkout._id).slice(-8)}`,
      returnUrl: `${env.appUrl}${env.apiPrefix}/payments/payos/return`,
      cancelUrl: `${env.appUrl}${env.apiPrefix}/payments/payos/cancel`,
    })
    attempt.checkoutUrl = link.checkoutUrl
    attempt.status = PAYMENT_ATTEMPT_STATUS.PENDING
    await attempt.save()
    return attempt
  } catch (error) {
    attempt.status = PAYMENT_ATTEMPT_STATUS.FAILED
    attempt.failureReason = error.message
    await attempt.save()
    throw error
  }
}

export const createPaymentAttempt = async (command) => {
  return runIdempotentCommand({
    commandKey: `payment:${command.buyerId}:${command.idempotencyKey}`,
    resourceType: 'PaymentAttempt',
    loadResource: (resourceId) => PaymentAttempt.findById(resourceId),
    execute: () => createPaymentAttemptCommand(command),
  })
}

export const handlePayosWebhook = async (payload) => {
  let verified
  try {
    verified = await payosProvider.verifyWebhook(payload)
  } catch {
    throw new AppError('Chữ ký PayOS không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYOS_SIGNATURE')
  }
  const attempt = await PaymentAttempt.findOne({ provider: 'payos', providerOrderCode: Number(verified.orderCode) })
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  if (Number(verified.amount) !== attempt.amount) throw new AppError('Số tiền thanh toán không khớp', HTTP_STATUS.BAD_REQUEST, 'PAYMENT_AMOUNT_MISMATCH')
  if (payload.code !== '00') return attempt
  return markPaymentSucceeded(attempt._id, verified.reference || null, payload, 'payos_webhook')
}

export const getPaymentAttempt = async (attemptId, buyerId) => {
  const attempt = await PaymentAttempt.findOne({ _id: attemptId, buyer: buyerId }).populate('checkout').populate('orders')
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  return attempt
}

export const getPayosReturnResult = async (orderCode) => {
  const attempt = await PaymentAttempt.findOne({ provider: 'payos', providerOrderCode: Number(orderCode) })
    .select('_id checkout status merchantReference')
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  return attempt
}

const recordVnpayTerminalResult = async (attempt, status, payload) => {
  if (attempt.status === PAYMENT_ATTEMPT_STATUS.SUCCEEDED) return attempt
  const terminal = [PAYMENT_ATTEMPT_STATUS.FAILED, PAYMENT_ATTEMPT_STATUS.CANCELLED, PAYMENT_ATTEMPT_STATUS.EXPIRED]
  if (terminal.includes(attempt.status)) return attempt
  attempt.status = status === 'cancelled' ? PAYMENT_ATTEMPT_STATUS.CANCELLED : PAYMENT_ATTEMPT_STATUS.FAILED
  attempt.failureReason = payload.vnp_ResponseCode || status
  attempt.callbackHistory.push({ payloadHash: hashPayload(payload), verifiedAt: new Date(), providerStatus: status })
  await attempt.save()
  return attempt
}

export const handleVnpayIpn = async (callbackPayload) => {
  const { valid, payload } = vnpayProvider.verifyCallback(callbackPayload)
  if (!valid) throw new AppError('Chữ ký VNPay không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_VNPAY_SIGNATURE')
  const attempt = await PaymentAttempt.findOne({ provider: 'vnpay', merchantReference: payload.vnp_TxnRef })
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  if (Number(payload.vnp_Amount || 0) !== attempt.amount * 100) {
    throw new AppError('Số tiền thanh toán không khớp', HTTP_STATUS.BAD_REQUEST, 'PAYMENT_AMOUNT_MISMATCH')
  }
  const status = vnpayProvider.transactionStatus(payload)
  attempt.providerTransactionDate = payload.vnp_PayDate || attempt.providerCreatedAt
  await attempt.save()
  if (status !== 'succeeded') return recordVnpayTerminalResult(attempt, status, payload)
  return markPaymentSucceeded(attempt._id, payload.vnp_TransactionNo || null, payload, 'vnpay_ipn')
}

export const getVnpayReturnResult = async (callbackPayload) => {
  const { valid, payload } = vnpayProvider.verifyCallback(callbackPayload)
  if (!valid) throw new AppError('Chữ ký VNPay không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_VNPAY_SIGNATURE')
  const attempt = await PaymentAttempt.findOne({ provider: 'vnpay', merchantReference: payload.vnp_TxnRef })
    .select('_id checkout status merchantReference')
  if (!attempt) throw new AppError('Không tìm thấy giao dịch', HTTP_STATUS.NOT_FOUND, 'PAYMENT_ATTEMPT_NOT_FOUND')
  return attempt
}

export const expireCheckout = async (checkoutId) => runRequiredMongoTransaction(async (session) => {
  const checkout = await Checkout.findOneAndUpdate(
    { _id: checkoutId, status: CHECKOUT_STATUS.PAYMENT_PENDING, expiresAt: { $lte: new Date() } },
    { status: CHECKOUT_STATUS.EXPIRED },
    { returnDocument: 'after', session }
  )
  if (!checkout) return null
  const reservations = await InventoryReservation.find({ checkout: checkout._id }).session(session)
  for (const reservation of reservations) await releaseReservation(reservation._id, session, true)
  await Order.updateMany({ checkout: checkout._id }, { commerceStatus: COMMERCE_ORDER_STATUS.EXPIRED }, { session })
  await PaymentAttempt.updateMany(
    { checkout: checkout._id, status: { $in: [PAYMENT_ATTEMPT_STATUS.CREATED, PAYMENT_ATTEMPT_STATUS.PENDING] } },
    { status: PAYMENT_ATTEMPT_STATUS.EXPIRED },
    { session }
  )
  return checkout
})
