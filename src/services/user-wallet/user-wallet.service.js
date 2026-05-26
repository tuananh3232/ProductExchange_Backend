import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { USER_WALLET_TRANSACTION_TYPE, PAYMENT_STATUS, ORDER_STATUS } from '../../constants/status.constant.js'
import { USER_WALLET_CONSTANTS } from '../../constants/wallet.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'
import Order from '../../models/order.model.js'

// ─── Get wallet ──────────────────────────────────────────────────────────────

export const getMyWallet = async (userId) => {
  const wallet = await userWalletRepo.findByUser(userId)
  if (!wallet) {
    return { user: userId, balance: 0, totalTopUp: 0, totalSpent: 0, isActive: true }
  }
  return wallet
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export const getMyTransactions = async (userId, pagination) => {
  const { page, limit, skip, sortBy, sortOrder } = pagination
  const filter = { user: userId }
  const [transactions, total] = await Promise.all([
    userWalletRepo.findTransactions({ filter, skip, limit, sortBy, sortOrder }),
    userWalletRepo.countTransactions(filter),
  ])
  return { transactions, meta: buildPaginationMeta(total, page, limit) }
}

// ─── Topup history ────────────────────────────────────────────────────────────

export const getMyTopups = async (userId, pagination) => {
  const { page, limit, skip, sortBy, sortOrder } = pagination
  const filter = { user: userId }
  const [topups, total] = await Promise.all([
    userWalletRepo.findTopups({ filter, skip, limit, sortBy, sortOrder }),
    userWalletRepo.countTopups(filter),
  ])
  return { topups, meta: buildPaginationMeta(total, page, limit) }
}

// ─── Pay order with wallet ───────────────────────────────────────────────────

export const payOrderWithWallet = async (orderId, userContext) => {
  const userId = userContext._id

  const order = await Order.findById(orderId).populate('buyer', '_id')
  if (!order || !order.isActive) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  const buyerId = order.buyer?._id?.toString() || order.buyer?.toString()
  if (buyerId !== userId.toString()) {
    throw new AppError('Bạn không có quyền thanh toán đơn hàng này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (order.status !== ORDER_STATUS.PENDING) {
    throw new AppError('Chỉ có thể thanh toán đơn hàng ở trạng thái chờ xác nhận', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.ORDER_NOT_PAYABLE)
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new AppError('Đơn hàng đã được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.PAYMENT.ALREADY_PAID)
  }

  if (order.paymentStatus !== PAYMENT_STATUS.UNPAID) {
    throw new AppError('Đơn hàng đang được xử lý bởi phương thức thanh toán khác', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.ALREADY_PAID_BY_OTHER)
  }

  const amount = Math.round(Number(order.totalAmount))

  // Atomic deduct — bảo vệ race condition, trả về null nếu không đủ số dư
  const wallet = await userWalletRepo.findByUser(userId)
  const balanceBefore = wallet?.balance || 0

  const updatedWallet = await userWalletRepo.deductForOrder(userId, amount)
  if (!updatedWallet) {
    throw new AppError('Số dư ví không đủ để thanh toán đơn hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
  }

  const paidAt = new Date()

  await Order.findByIdAndUpdate(orderId, {
    paymentStatus: PAYMENT_STATUS.PAID,
    paymentMethod: 'wallet',
    paymentProvider: 'wallet',
    paymentRef: `WALLET_${userId}_${Date.now()}`,
    paidAt,
  })

  const tx = await userWalletRepo.createTransaction({
    wallet: updatedWallet._id,
    user: userId,
    order: orderId,
    type: USER_WALLET_TRANSACTION_TYPE.PAYMENT,
    amount,
    balanceBefore,
    balanceAfter: updatedWallet.balance,
    description: `Thanh toán đơn hàng #${orderId.toString().slice(-8)}`,
    metadata: { orderId },
  })

  return { wallet: updatedWallet, transaction: tx }
}

// ─── Refund to wallet (called internally on order cancel) ────────────────────

export const refundWalletForOrder = async (order) => {
  const orderId = order._id
  const userId = order.buyer?._id || order.buyer

  // idempotency — tránh hoàn tiền 2 lần cho cùng 1 order
  const existing = await userWalletRepo.findTransactionByOrder(orderId)
  if (existing) return existing

  const amount = Math.round(Number(order.totalAmount))

  const walletBefore = await userWalletRepo.findByUser(userId)
  const balanceBefore = walletBefore?.balance || 0

  const updatedWallet = await userWalletRepo.refundFromOrder(userId, amount)

  return userWalletRepo.createTransaction({
    wallet: updatedWallet._id,
    user: userId,
    order: orderId,
    type: USER_WALLET_TRANSACTION_TYPE.REFUND,
    amount,
    balanceBefore,
    balanceAfter: updatedWallet.balance,
    description: `Hoàn tiền đơn hàng #${orderId.toString().slice(-8)}`,
    metadata: { orderId },
  })
}

// ─── Credit wallet after topup (called by payment service) ───────────────────

export const creditWalletFromTopup = async (topup) => {
  const { user: userId, amount, _id: topupId } = topup

  // idempotency
  const existing = await userWalletRepo.findTransactionByTopup(topupId)
  if (existing) return existing

  const walletBefore = await userWalletRepo.findByUser(userId)
  const balanceBefore = walletBefore?.balance || 0

  const updatedWallet = await userWalletRepo.creditTopup(userId, amount)

  return userWalletRepo.createTransaction({
    wallet: updatedWallet._id,
    user: userId,
    topup: topupId,
    type: USER_WALLET_TRANSACTION_TYPE.TOPUP,
    amount,
    balanceBefore,
    balanceAfter: updatedWallet.balance,
    description: `Nạp tiền vào ví ${amount.toLocaleString('vi-VN')} VNĐ`,
    metadata: { topupId },
  })
}
