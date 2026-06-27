import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { USER_WALLET_TRANSACTION_TYPE, PAYMENT_STATUS, ORDER_STATUS, WITHDRAWAL_STATUS } from '../../constants/status.constant.js'
import { USER_WALLET_CONSTANTS } from '../../constants/wallet.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { sanitizeWithdrawalListItem } from '../../utils/security.util.js'
import { runMongoTransaction } from '../../utils/mongo-transaction.util.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'
import Order from '../../models/order.model.js'
import { notifySafely } from '../notification/notification.service.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import * as ledgerService from '../ledger/ledger.service.js'

// Trạng thái cho phép thanh toán lại bằng ví: chưa trả, hoặc lần thanh toán qua cổng
// trước đó đã bị bỏ dở (đang chờ/thất bại/đã hủy). Chỉ chặn khi đơn đã PAID hoặc đang hoàn tiền.
const WALLET_PAYABLE_STATUSES = [
  PAYMENT_STATUS.UNPAID,
  PAYMENT_STATUS.PENDING_PAYMENT,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.CANCELLED,
]

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

// ─── Unified activity feed ────────────────────────────────────────────────────

export const getMyActivity = async (userId, pagination) => {
  const { page, limit, skip } = pagination
  const { items, total } = await userWalletRepo.findActivityFeed({ userId, skip, limit })
  return { activities: items, meta: buildPaginationMeta(total, page, limit) }
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

  if (!WALLET_PAYABLE_STATUSES.includes(order.paymentStatus)) {
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

  await notifySafely({
    recipient: userId,
    type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    title: 'Thanh toán thành công',
    message: 'Đơn hàng của bạn đã được thanh toán bằng ví',
    targetType: NOTIFICATION_TARGET_TYPES.ORDER,
    targetId: orderId,
    actionUrl: `/orders/${orderId}`,
    data: { orderId, transactionId: tx._id },
  })

  await ledgerService.settlePaidOrder(orderId, { source: 'user_wallet' })

  return { wallet: updatedWallet, transaction: tx }
}

// ─── Pay multiple orders with wallet ─────────────────────────────────────────

export const payOrdersWithWallet = async (orderIds, userContext) => {
  const userId = userContext._id
  const uniqueIds = [...new Set(orderIds.map(String))]

  const orders = await Order.find({ _id: { $in: uniqueIds }, isActive: true })
  if (orders.length !== uniqueIds.length) {
    throw new AppError('Không tìm thấy đơn hàng', HTTP_STATUS.NOT_FOUND, ERRORS.ORDER.NOT_FOUND)
  }

  for (const order of orders) {
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
    if (!WALLET_PAYABLE_STATUSES.includes(order.paymentStatus)) {
      throw new AppError('Đơn hàng đang được xử lý bởi phương thức thanh toán khác', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.ALREADY_PAID_BY_OTHER)
    }
  }

  const totalAmount = Math.round(orders.reduce((sum, o) => sum + Number(o.totalAmount), 0))

  const wallet = await userWalletRepo.findByUser(userId)
  const balanceBefore = wallet?.balance || 0

  const updatedWallet = await userWalletRepo.deductForOrder(userId, totalAmount)
  if (!updatedWallet) {
    throw new AppError('Số dư ví không đủ để thanh toán các đơn hàng', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
  }

  const paidAt = new Date()
  const paymentRef = `WALLET_${userId}_${Date.now()}`

  await Order.updateMany(
    { _id: { $in: uniqueIds } },
    { paymentStatus: PAYMENT_STATUS.PAID, paymentMethod: 'wallet', paymentProvider: 'wallet', paymentRef, paidAt }
  )

  let runningBalance = balanceBefore
  const transactions = []
  for (const order of orders) {
    const amount = Math.round(Number(order.totalAmount))
    const balanceAfter = runningBalance - amount
    const tx = await userWalletRepo.createTransaction({
      wallet: updatedWallet._id,
      user: userId,
      order: order._id,
      type: USER_WALLET_TRANSACTION_TYPE.PAYMENT,
      amount,
      balanceBefore: runningBalance,
      balanceAfter,
      description: `Thanh toán đơn hàng #${order._id.toString().slice(-8)}`,
      metadata: { orderId: order._id },
    })
    transactions.push(tx)
    runningBalance = balanceAfter
  }

  await notifySafely({
    recipient: userId,
    type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    title: 'Thanh toán thành công',
    message: `${orders.length} đơn hàng đã được thanh toán bằng ví`,
    targetType: NOTIFICATION_TARGET_TYPES.ORDER,
    targetId: orders[0]._id,
    actionUrl: '/orders',
    data: { orderIds: uniqueIds, totalAmount },
  })

  await Promise.all(uniqueIds.map((id) => ledgerService.settlePaidOrder(id, { source: 'user_wallet_batch' })))

  return { wallet: updatedWallet, transactions, orderCount: orders.length, totalAmount }
}

// ─── Refund to wallet (called internally on order cancel) ────────────────────

export const refundWalletForOrder = async (order) => {
  const orderId = order._id
  const userId = order.buyer?._id || order.buyer

  // idempotency — tránh hoàn tiền 2 lần cho cùng 1 order
  const existing = await userWalletRepo.findRefundTransactionByOrder(orderId)
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

// ─── Withdrawal ───────────────────────────────────────────────────────────────

const getUserWithdrawalOrThrow = async (withdrawalId) => {
  const withdrawal = await userWalletRepo.findWithdrawalById(withdrawalId)
  if (!withdrawal) {
    throw new AppError('Không tìm thấy yêu cầu rút tiền', HTTP_STATUS.NOT_FOUND, ERRORS.USER_WALLET.WITHDRAWAL_NOT_FOUND)
  }
  return withdrawal
}

export const requestWithdrawal = async (userContext, payload) => {
  const userId = userContext._id

  if (payload.amount < USER_WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối thiểu là ${USER_WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.USER_WALLET.WITHDRAWAL_AMOUNT_TOO_LOW
    )
  }

  if (payload.amount > USER_WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối đa là ${USER_WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.USER_WALLET.WITHDRAWAL_AMOUNT_TOO_HIGH
    )
  }

  const hasPending = await userWalletRepo.hasPendingWithdrawal(userId)
  if (hasPending) {
    throw new AppError('Bạn đang có yêu cầu rút tiền đang chờ xử lý', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.WITHDRAWAL_PENDING_EXISTS)
  }

  const wallet = await userWalletRepo.findOrCreateByUser(userId)

  const updatedWallet = await userWalletRepo.deductForWithdrawal(userId, payload.amount)
  if (!updatedWallet) {
    throw new AppError('Số dư ví không đủ để thực hiện yêu cầu rút tiền', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
  }

  return userWalletRepo.createWithdrawal({
    user: userId,
    wallet: wallet._id,
    amount: payload.amount,
    bankInfo: payload.bankInfo,
    note: payload.note || '',
  })
}

export const getMyWithdrawals = async (userId, pagination, statusFilter) => {
  const { page, limit, skip, sortBy, sortOrder } = pagination
  const filter = { user: userId }
  if (statusFilter) filter.status = statusFilter
  const [withdrawals, total] = await Promise.all([
    userWalletRepo.findWithdrawals({ filter, skip, limit, sortBy, sortOrder }),
    userWalletRepo.countWithdrawals(filter),
  ])
  return { withdrawals, meta: buildPaginationMeta(total, page, limit) }
}

export const adminGetUserWithdrawals = async (pagination, statusFilter) => {
  const { page, limit, skip, sortBy, sortOrder } = pagination
  const filter = {}
  if (statusFilter) filter.status = statusFilter
  const [withdrawals, total] = await Promise.all([
    userWalletRepo.findWithdrawals({ filter, skip, limit, sortBy, sortOrder }),
    userWalletRepo.countWithdrawals(filter),
  ])
  return {
    withdrawals: withdrawals.map(sanitizeWithdrawalListItem),
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const adminGetUserWithdrawalById = async (withdrawalId) => {
  const withdrawal = await getUserWithdrawalOrThrow(withdrawalId)
  return withdrawal
}

export const approveUserWithdrawal = async (withdrawalId, userContext) => {
  const withdrawal = await getUserWithdrawalOrThrow(withdrawalId)
  if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Yêu cầu rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.WITHDRAWAL_INVALID_STATUS)
  }
  const updated = await userWalletRepo.updateWithdrawalById(withdrawalId, {
    status: WITHDRAWAL_STATUS.APPROVED,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'USER_WITHDRAWAL_APPROVED',
    targetType: 'withdrawal',
    targetId: withdrawal._id,
    previousStatus: withdrawal.status,
    newStatus: WITHDRAWAL_STATUS.APPROVED,
    metadata: { userId: withdrawal.user?._id || withdrawal.user, amount: withdrawal.amount },
  })

  return updated
}

export const rejectUserWithdrawal = async (withdrawalId, userContext, rejectionReason, adminNote = '') => {
  const withdrawal = await getUserWithdrawalOrThrow(withdrawalId)
  if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Yêu cầu rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.WITHDRAWAL_INVALID_STATUS)
  }

  const userId = withdrawal.user?._id || withdrawal.user
  const updated = await runMongoTransaction(async (session) => {
    const options = session ? { session } : {}
    const updated = await userWalletRepo.updateWithdrawalById(withdrawalId, {
      status: WITHDRAWAL_STATUS.REJECTED,
      rejectionReason,
      adminNote,
      approvedBy: userContext._id,
      approvedAt: new Date(),
    }, options)

    await userWalletRepo.revertWithdrawal(userId, withdrawal.amount, options)
    return updated
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'USER_WITHDRAWAL_REJECTED',
    targetType: 'withdrawal',
    targetId: withdrawal._id,
    previousStatus: withdrawal.status,
    newStatus: WITHDRAWAL_STATUS.REJECTED,
    reason: rejectionReason,
    adminNote,
    metadata: { userId, amount: withdrawal.amount },
  })

  return updated
}

export const completeUserWithdrawal = async (withdrawalId, userContext, adminNote = '', transferProof) => {
  const withdrawal = await getUserWithdrawalOrThrow(withdrawalId)
  if (withdrawal.status !== WITHDRAWAL_STATUS.APPROVED) {
    throw new AppError('Yêu cầu rút tiền chưa được duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.WITHDRAWAL_INVALID_STATUS)
  }

  const userId = withdrawal.user?._id || withdrawal.user

  const update = {
    status: WITHDRAWAL_STATUS.COMPLETED,
    adminNote,
    completedBy: userContext._id,
    completedAt: new Date(),
  }
  if (transferProof) update.transferProof = transferProof
  const updated = await runMongoTransaction(async (session) => {
    const options = session ? { session } : {}
    const updated = await userWalletRepo.updateWithdrawalById(withdrawalId, update, options)

    await userWalletRepo.completeWithdrawal(userId, withdrawal.amount, options)

    const walletAfter = await userWalletRepo.findByUser(userId, options)
    await userWalletRepo.createTransaction({
      wallet: withdrawal.wallet,
      user: userId,
      type: USER_WALLET_TRANSACTION_TYPE.WITHDRAWAL,
      amount: withdrawal.amount,
      balanceBefore: (walletAfter?.balance ?? 0) + withdrawal.amount,
      balanceAfter: walletAfter?.balance ?? 0,
      description: `Withdrawal request #${withdrawalId.toString().slice(-8)}`,
      metadata: { withdrawalId },
    }, options)

    return updated
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'USER_WITHDRAWAL_COMPLETED',
    targetType: 'withdrawal',
    targetId: withdrawal._id,
    previousStatus: withdrawal.status,
    newStatus: WITHDRAWAL_STATUS.COMPLETED,
    adminNote,
    metadata: { userId, amount: withdrawal.amount, transferProof },
  })

  return updated
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
