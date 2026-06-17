import { PayOS } from '@payos/node'
import User from '../../models/user.model.js'
import SubscriptionOrder from '../../models/subscription-order.model.js'
import AppError from '../../utils/app-error.util.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { env } from '../../configs/env.config.js'
import { reconcileOwnerShopQuota } from '../shop/shop.service.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'
import { USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import ERRORS from '../../constants/error.constant.js'

export const PLANS = {
  monthly: { price: 69000, days: 30, label: 'thang' },
  yearly: { price: 499000, days: 365, label: 'nam' },
}

const getPayosClient = () => {
  const { clientId, apiKey, checksumKey } = env.payment.payos
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError('PayOS chua duoc cau hinh', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'PAYOS_NOT_CONFIGURED')
  }
  return new PayOS({ clientId, apiKey, checksumKey })
}

const _activateVip = async (userId, plan) => {
  const user = await User.findById(userId)
  const { days } = PLANS[plan]
  const now = new Date()
  const currentExpiry = user.vip?.expiresAt
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now
  const expiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 'vip.plan': plan, 'vip.expiresAt': expiresAt },
    { new: true }
  )

  await reconcileOwnerShopQuota(userId, { userDoc: updatedUser })
}

export const createSubscriptionCheckout = async (plan, userContext, paymentMethod = 'payos') => {
  if (!PLANS[plan]) {
    throw new AppError('Gói VIP không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_SUBSCRIPTION_PLAN')
  }

  const { price, label } = PLANS[plan]

  if (paymentMethod === 'wallet') {
    const userId = userContext._id
    const wallet = await userWalletRepo.findByUser(userId)
    const balanceBefore = wallet?.balance || 0

    if (balanceBefore < price) {
      throw new AppError(
        'Số dư ví không đủ để đăng ký gói VIP',
        HTTP_STATUS.BAD_REQUEST,
        ERRORS.USER_WALLET.INSUFFICIENT_BALANCE
      )
    }

    // Trừ số dư atomically
    const updatedWallet = await userWalletRepo.deductForOrder(userId, price)
    if (!updatedWallet) {
      throw new AppError(
        'Số dư ví không đủ để đăng ký gói VIP',
        HTTP_STATUS.BAD_REQUEST,
        ERRORS.USER_WALLET.INSUFFICIENT_BALANCE
      )
    }

    const orderCode = Date.now() % 1000000000
    const transactionRef = `SUB_WALLET_${orderCode}`

    // Tạo subscription order ở trạng thái completed
    const subOrder = await SubscriptionOrder.create({
      user: userId,
      plan,
      amount: price,
      orderCode,
      transactionRef,
      status: 'completed',
      checkoutUrl: null,
      paidAt: new Date(),
    })

    // Ghi nhận giao dịch ví cá nhân
    await userWalletRepo.createTransaction({
      wallet: updatedWallet._id,
      user: userId,
      type: USER_WALLET_TRANSACTION_TYPE.PAYMENT,
      amount: price,
      balanceBefore,
      balanceAfter: updatedWallet.balance,
      description: `Thanh toán đăng ký gói VIP ${plan === 'monthly' ? 'Monthly' : 'Yearly'}`,
      metadata: { subscriptionOrderId: subOrder._id, plan },
    })

    // Kích hoạt VIP
    await _activateVip(userId, plan)

    return { success: true, activated: true, plan }
  }

  const existingPending = await SubscriptionOrder.findOne({ user: userContext._id, status: 'pending' })
  if (existingPending?.checkoutUrl) {
    try {
      const payos = getPayosClient()
      const paymentInfo = await payos.paymentRequests.get(existingPending.orderCode)
      if (paymentInfo.status === 'PENDING') {
        return { paymentUrl: existingPending.checkoutUrl, plan: existingPending.plan }
      }

      // Sync the non-pending status to DB
      const nextStatus = paymentInfo.status === 'PAID' ? 'completed' : 'cancelled'
      existingPending.status = nextStatus
      if (nextStatus === 'completed') {
        existingPending.paidAt = new Date()
        await _activateVip(existingPending.user, existingPending.plan)
      }
      await existingPending.save()
    } catch (error) {
      // If payment request retrieval fails (e.g. doesn't exist on PayOS anymore), mark as cancelled in DB
      existingPending.status = 'cancelled'
      await existingPending.save()
    }
  }

  const payos = getPayosClient()
  const orderCode = Date.now() % 1000000000
  const transactionRef = `SUB_${orderCode}`
  const shortId = userContext._id.toString().slice(-6)

  const paymentLink = await payos.paymentRequests.create({
    orderCode,
    amount: price,
    description: `VIP ${label} #${shortId}`,
    returnUrl: env.payment.payos.subReturnUrl,
    cancelUrl: env.payment.payos.subCancelUrl,
  })

  await SubscriptionOrder.create({
    user: userContext._id,
    plan,
    amount: price,
    orderCode,
    transactionRef,
    status: 'pending',
    checkoutUrl: paymentLink.checkoutUrl,
  })

  return { paymentUrl: paymentLink.checkoutUrl, plan }
}

export const handleSubscriptionWebhook = async (webhookData) => {
  const payos = getPayosClient()

  let verifiedData
  try {
    verifiedData = await payos.webhooks.verify(webhookData)
  } catch {
    throw new AppError('Chữ ký PayOS không hợp lệ', HTTP_STATUS.BAD_REQUEST, 'INVALID_SIGNATURE')
  }

  const sub = await SubscriptionOrder.findOne({ orderCode: verifiedData.orderCode })
  if (!sub) {
    throw new AppError('Không tìm thấy đơn đăng ký VIP', HTTP_STATUS.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND')
  }

  if (sub.status !== 'pending') return { sub, status: sub.status }

  const nextStatus = verifiedData.code === '00' ? 'completed' : 'failed'

  sub.status = nextStatus
  sub.rawCallbackData = webhookData
  if (nextStatus === 'completed') {
    sub.paidAt = new Date()
    await _activateVip(sub.user, sub.plan)
  }
  await sub.save()

  return { sub, status: nextStatus }
}

export const handleSubscriptionReturn = async (query, userId) => {
  const { orderCode, cancel, code } = query
  if (!orderCode) {
    throw new AppError('Thieu thong tin callback', HTTP_STATUS.BAD_REQUEST, 'MISSING_ORDER_CODE')
  }

  const sub = await SubscriptionOrder.findOne({ orderCode: Number(orderCode) })
  if (!sub) {
    throw new AppError('Không tìm thấy đơn đăng ký VIP', HTTP_STATUS.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND')
  }

  if (sub.user.toString() !== userId.toString()) {
    throw new AppError('Bạn không có quyền xác minh đơn này', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN')
  }

  if (sub.status !== 'pending') return { status: sub.status, plan: sub.plan }

  let paymentStatus
  try {
    const payos = getPayosClient()
    const paymentInfo = await payos.paymentRequests.get(Number(orderCode))
    paymentStatus = paymentInfo.status
  } catch {
    const isCancelled = cancel === 'true' || cancel === true
    if (isCancelled) paymentStatus = 'CANCELLED'
    else if (code === '00') paymentStatus = 'PAID'
    else paymentStatus = 'PENDING'
  }

  if (paymentStatus === 'PENDING' || paymentStatus === 'PROCESSING') {
    return { status: 'pending' }
  }

  const nextStatus = paymentStatus === 'PAID' ? 'completed' : 'cancelled'

  sub.status = nextStatus
  if (nextStatus === 'completed') {
    sub.paidAt = new Date()
    await _activateVip(sub.user, sub.plan)
  }
  await sub.save()

  return { status: nextStatus, plan: sub.plan }
}

export const getMySubscription = async (userId) => {
  const user = await User.findById(userId).select('vip')
  const { plan, expiresAt } = user.vip || {}
  const now = new Date()
  const isActive = Boolean(expiresAt && expiresAt > now)
  const daysLeft = isActive ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : 0
  return {
    isActive,
    plan: isActive ? plan : null,
    expiresAt: isActive ? expiresAt : null,
    daysLeft,
  }
}
