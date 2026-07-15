import crypto from 'crypto'
import { PayOS } from '@payos/node'
import User from '../../models/user.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import UserWalletTransaction from '../../models/user-wallet-transaction.model.js'
import SubscriptionOrder from '../../models/subscription-order.model.js'
import Counter from '../../models/counter.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { env } from '../../configs/env.config.js'
import { reconcileOwnerShopQuota } from '../shop/shop.service.js'
import { USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import ERRORS from '../../constants/error.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'

export const PLANS = {
  monthly: { price: 69000, days: 30, label: 'tháng' },
  yearly: { price: 499000, days: 365, label: 'năm' },
}

const getPayosClient = () => {
  const { clientId, apiKey, checksumKey } = env.payment.payos
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError('PayOS chưa được cấu hình', HTTP_STATUS.SERVICE_UNAVAILABLE, 'PAYOS_NOT_CONFIGURED')
  }
  return new PayOS({ clientId, apiKey, checksumKey })
}

const nextOrderCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { key: 'subscription_order_code' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )
  if (counter.value > 999999999) throw new AppError('Đã hết dải mã subscription', HTTP_STATUS.SERVICE_UNAVAILABLE, 'SUBSCRIPTION_SEQUENCE_EXHAUSTED')
  return counter.value
}

const activateVip = async (userId, plan, session) => {
  const user = await User.findById(userId, null, { session })
  if (!user) throw new AppError('Không tìm thấy người dùng', HTTP_STATUS.NOT_FOUND, 'USER_NOT_FOUND')
  const now = new Date()
  const currentExpiry = user.vip?.expiresAt
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now
  const expiresAt = new Date(base.getTime() + PLANS[plan].days * 24 * 60 * 60 * 1000)
  return User.findByIdAndUpdate(
    userId,
    { 'vip.plan': plan, 'vip.expiresAt': expiresAt },
    { returnDocument: 'after', session }
  )
}

const finishQuotaSync = (userId, userDoc) => reconcileOwnerShopQuota(userId, { userDoc })

export const createSubscriptionCheckout = async (plan, userContext, paymentMethod = 'payos', idempotencyKey = crypto.randomUUID()) => {
  if (!PLANS[plan]) throw new AppError('Gói VIP không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_SUBSCRIPTION_PLAN')
  const userId = userContext._id
  const existing = await SubscriptionOrder.findOne({ user: userId, idempotencyKey })
  if (existing) {
    return existing.status === 'completed'
      ? { success: true, activated: true, plan: existing.plan, orderId: existing._id }
      : { paymentUrl: existing.checkoutUrl, plan: existing.plan, orderId: existing._id, status: existing.status }
  }
  const { price, label } = PLANS[plan]
  const orderCode = await nextOrderCode()
  const transactionRef = `${paymentMethod === 'wallet' ? 'SUB-WALLET' : 'SUB-PAYOS'}-${orderCode}`

  if (paymentMethod === 'wallet') {
    let activatedUser
    const subOrder = await runRequiredMongoTransaction(async (session) => {
      const duplicate = await SubscriptionOrder.findOne({ user: userId, idempotencyKey }, null, { session })
      if (duplicate) return duplicate
      const wallet = await UserWallet.findOneAndUpdate(
        { user: userId, isActive: true, balance: { $gte: price } },
        { $inc: { balance: -price, totalSpent: price } },
        { returnDocument: 'after', session }
      )
      if (!wallet) throw new AppError('Số dư ví không đủ để đăng ký gói VIP', HTTP_STATUS.CONFLICT, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
      const [created] = await SubscriptionOrder.create([{
        user: userId, plan, amount: price, orderCode, transactionRef, idempotencyKey,
        paymentMethod: 'wallet', status: 'completed', paidAt: new Date(),
      }], { session })
      await postBalancedTransaction({
        commandKey: `subscription_payment:${created._id}`,
        transactionType: 'subscription_payment',
        referenceType: 'SubscriptionOrder',
        referenceId: created._id,
        entries: [
          { account: accountDefinitions.userWallet(userId), direction: 'debit', amount: price },
          { account: accountDefinitions.platformRevenue(), direction: 'credit', amount: price },
        ],
      }, session)
      await UserWalletTransaction.create([{
        wallet: wallet._id,
        user: userId,
        type: USER_WALLET_TRANSACTION_TYPE.PAYMENT,
        amount: price,
        balanceBefore: wallet.balance + price,
        balanceAfter: wallet.balance,
        description: `Thanh toán gói VIP ${plan}`,
        metadata: { subscriptionOrderId: created._id, plan },
      }], { session })
      activatedUser = await activateVip(userId, plan, session)
      return created
    })
    if (activatedUser) await finishQuotaSync(userId, activatedUser)
    return { success: true, activated: true, plan, orderId: subOrder._id }
  }

  const subOrder = await SubscriptionOrder.create({
    user: userId, plan, amount: price, orderCode, transactionRef, idempotencyKey,
    paymentMethod: 'payos', status: 'pending', checkoutUrl: null,
  })
  try {
    const link = await getPayosClient().paymentRequests.create({
      orderCode,
      amount: price,
      description: `VIP ${label} #${userId.toString().slice(-6)}`,
      returnUrl: env.payment.payos.subReturnUrl,
      cancelUrl: env.payment.payos.subCancelUrl,
    })
    if (!link?.checkoutUrl) throw new Error('PayOS không trả về payment URL')
    subOrder.checkoutUrl = link.checkoutUrl
    await subOrder.save()
    return { paymentUrl: link.checkoutUrl, plan, orderId: subOrder._id }
  } catch (error) {
    subOrder.status = 'failed'
    subOrder.failureReason = error.message
    await subOrder.save()
    throw error
  }
}

export const handleSubscriptionWebhook = async (webhookData) => {
  let verified
  try {
    verified = await getPayosClient().webhooks.verify(webhookData)
  } catch {
    throw new AppError('Chữ ký PayOS không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_SIGNATURE')
  }
  const current = await SubscriptionOrder.findOne({ orderCode: Number(verified.orderCode) })
  if (!current) throw new AppError('Không tìm thấy đơn đăng ký VIP', HTTP_STATUS.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND')
  if (current.status !== 'pending') return { sub: current, status: current.status }
  if (Number(verified.amount) !== current.amount) throw new AppError('Số tiền subscription không khớp', HTTP_STATUS.BAD_REQUEST, 'PAYMENT_AMOUNT_MISMATCH')
  if (verified.code !== '00') {
    current.status = 'failed'
    current.rawCallbackData = webhookData
    await current.save()
    return { sub: current, status: current.status }
  }

  let activatedUser
  const sub = await runRequiredMongoTransaction(async (session) => {
    const order = await SubscriptionOrder.findOneAndUpdate(
      { _id: current._id, status: 'pending' },
      { status: 'completed', paidAt: new Date(), rawCallbackData: webhookData },
      { returnDocument: 'after', session }
    )
    if (!order) return SubscriptionOrder.findById(current._id, null, { session })
    await postBalancedTransaction({
      commandKey: `subscription_payment:${order._id}`,
      transactionType: 'subscription_payment',
      referenceType: 'SubscriptionOrder',
      referenceId: order._id,
      entries: [
        { account: accountDefinitions.providerClearing('payos'), direction: 'debit', amount: order.amount },
        { account: accountDefinitions.platformRevenue(), direction: 'credit', amount: order.amount },
      ],
    }, session)
    activatedUser = await activateVip(order.user, order.plan, session)
    return order
  })
  if (activatedUser) await finishQuotaSync(sub.user, activatedUser)
  return { sub, status: sub.status }
}

export const handleSubscriptionReturn = async (query, userId) => {
  if (!query.orderCode) throw new AppError('Thiếu thông tin callback', HTTP_STATUS.BAD_REQUEST, 'MISSING_ORDER_CODE')
  const sub = await SubscriptionOrder.findOne({ orderCode: Number(query.orderCode) })
  if (!sub) throw new AppError('Không tìm thấy đơn đăng ký VIP', HTTP_STATUS.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND')
  if (String(sub.user) !== String(userId)) throw new AppError('Bạn không có quyền xem đơn này', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN')
  let providerStatus = 'UNKNOWN'
  try {
    providerStatus = (await getPayosClient().paymentRequests.get(Number(query.orderCode))).status
  } catch {
    providerStatus = 'UNAVAILABLE'
  }
  return { status: sub.status, providerStatus, plan: sub.plan }
}

export const getMySubscription = async (userId) => {
  const user = await User.findById(userId).select('vip')
  const { plan, expiresAt } = user.vip || {}
  const isActive = Boolean(expiresAt && expiresAt > new Date())
  return {
    isActive,
    plan: isActive ? plan : null,
    expiresAt: isActive ? expiresAt : null,
    daysLeft: isActive ? Math.ceil((expiresAt - Date.now()) / 86400000) : 0,
  }
}
