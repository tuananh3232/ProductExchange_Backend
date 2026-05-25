import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { WALLET_TRANSACTION_TYPE, WITHDRAWAL_STATUS } from '../../constants/status.constant.js'
import { WALLET_CONSTANTS } from '../../constants/wallet.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { isAdmin, assertShopPermission } from '../../utils/data-scope.util.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import * as walletRepo from '../../repositories/wallet/wallet.repository.js'
import * as withdrawalRepo from '../../repositories/withdrawal-request/withdrawal-request.repository.js'
import Shop from '../../models/shop.model.js'

const PLATFORM_FEE_RATE = WALLET_CONSTANTS.PLATFORM_FEE_RATE

// ─── Private helpers ────────────────────────────────────────────────────────

const assertShopOwnerOnly = async (shopId, userId) => {
  const shop = await Shop.findById(shopId).select('owner isActive').lean()
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
  }
  if (shop.owner.toString() !== userId.toString()) {
    throw new AppError('Bạn không có quyền thực hiện thao tác này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
}

const getWithdrawalOrThrow = async (withdrawalId) => {
  const request = await withdrawalRepo.findById(withdrawalId)
  if (!request) {
    throw new AppError('Không tìm thấy lệnh rút tiền', HTTP_STATUS.NOT_FOUND, ERRORS.WITHDRAWAL.NOT_FOUND)
  }
  return request
}

const queryWithdrawals = async (filter, { page, limit, skip, sortBy, sortOrder }) => {
  const [withdrawals, total] = await Promise.all([
    withdrawalRepo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    withdrawalRepo.countMany(filter),
  ])
  return { withdrawals, meta: buildPaginationMeta(total, page, limit) }
}

// ─── Exported service functions ─────────────────────────────────────────────

export const creditFromOrder = async (order) => {
  const shopId = order.shop?._id || order.shop
  const orderId = order._id

  // idempotency — tránh credit 2 lần cho cùng 1 order
  const existing = await walletRepo.findTransactionByOrder(orderId)
  if (existing) return existing

  const grossAmount = order.totalAmount
  const platformFee = Math.round(grossAmount * PLATFORM_FEE_RATE)
  const netAmount = grossAmount - platformFee

  const wallet = await walletRepo.incrementBalance(shopId, netAmount)

  return walletRepo.createTransaction({
    wallet: wallet._id,
    shop: shopId,
    order: orderId,
    type: WALLET_TRANSACTION_TYPE.CREDIT,
    grossAmount,
    platformFee,
    netAmount,
    description: `Nhận tiền đơn hàng #${orderId}`,
    metadata: { orderId, grossAmount, platformFee },
  })
}

export const getWallet = async (shopId, userContext) => {
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.WALLET_VIEW })

  const wallet = await walletRepo.findByShop(shopId)
  if (!wallet) {
    const shop = await Shop.findById(shopId).select('_id').lean()
    if (!shop) {
      throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND)
    }
    return { shop: shopId, balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 }
  }
  return wallet
}

export const getTransactions = async (shopId, userContext, pagination) => {
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.WALLET_VIEW })

  const { page, limit, skip, sortBy, sortOrder } = pagination
  const filter = { shop: shopId }
  const [transactions, total] = await Promise.all([
    walletRepo.findTransactions({ filter, skip, limit, sortBy, sortOrder }),
    walletRepo.countTransactions(filter),
  ])
  return { transactions, meta: buildPaginationMeta(total, page, limit) }
}

export const requestWithdrawal = async (shopId, userContext, payload) => {
  // chỉ shop owner được tạo lệnh rút, không cho admin hay staff
  await assertShopOwnerOnly(shopId, userContext._id)

  // Validate amount
  if (payload.amount < WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối thiểu là ${WALLET_CONSTANTS.MIN_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.AMOUNT_TOO_LOW
    )
  }

  if (payload.amount > WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT) {
    throw new AppError(
      `Số tiền rút tối đa là ${WALLET_CONSTANTS.MAX_WITHDRAWAL_AMOUNT.toLocaleString('vi-VN')} VNĐ`,
      HTTP_STATUS.BAD_REQUEST,
      ERRORS.WALLET.AMOUNT_TOO_HIGH
    )
  }

  const hasPending = await withdrawalRepo.hasPendingRequest(shopId)
  if (hasPending) {
    throw new AppError('Bạn đang có lệnh rút tiền đang chờ xử lý', HTTP_STATUS.BAD_REQUEST, ERRORS.WALLET.PENDING_WITHDRAWAL_EXISTS)
  }

  const wallet = await walletRepo.findOrCreateByShop(shopId)

  // atomic deduct — điều kiện balance >= amount nằm trong query, bảo vệ race condition
  const updatedWallet = await walletRepo.deductForWithdrawal(shopId, payload.amount)
  if (!updatedWallet) {
    throw new AppError('Số dư không đủ để thực hiện lệnh rút', HTTP_STATUS.BAD_REQUEST, ERRORS.WALLET.INSUFFICIENT_BALANCE)
  }

  return withdrawalRepo.create({
    shop: shopId,
    wallet: wallet._id,
    requestedBy: userContext._id,
    amount: payload.amount,
    bankInfo: payload.bankInfo,
    note: payload.note || '',
  })
}

export const getWithdrawals = async (shopId, userContext, pagination, statusFilter) => {
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.WALLET_VIEW })

  const filter = { shop: shopId }
  if (statusFilter) filter.status = statusFilter
  return queryWithdrawals(filter, pagination)
}

export const adminGetWithdrawals = async (pagination, statusFilter) => {
  const filter = {}
  if (statusFilter) filter.status = statusFilter
  return queryWithdrawals(filter, pagination)
}

export const approveWithdrawal = async (withdrawalId, userContext) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Lệnh rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }

  return withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.APPROVED,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })
}

export const rejectWithdrawal = async (withdrawalId, userContext, rejectionReason, adminNote = '') => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Lệnh rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }

  const shopId = request.shop?._id || request.shop

  // Đánh dấu REJECTED trước → tránh admin reject 2 lần gây double revert balance
  const updated = await withdrawalRepo.updateById(withdrawalId, {
    status: WITHDRAWAL_STATUS.REJECTED,
    rejectionReason,
    adminNote,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })

  await walletRepo.revertWithdrawal(shopId, request.amount)

  return updated
}

export const completeWithdrawal = async (withdrawalId, userContext, adminNote = '', transferProof) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.APPROVED) {
    throw new AppError('Lệnh rút tiền chưa được duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }

  const shopId = request.shop?._id || request.shop

  // Đánh dấu COMPLETED trước → tránh admin complete 2 lần gây double debit wallet
  const update = {
    status: WITHDRAWAL_STATUS.COMPLETED,
    adminNote,
    completedBy: userContext._id,
    completedAt: new Date(),
  }
  if (transferProof) update.transferProof = transferProof

  const updated = await withdrawalRepo.updateById(withdrawalId, update)

  await walletRepo.completeWithdrawal(shopId, request.amount)

  await walletRepo.createTransaction({
    wallet: request.wallet,
    shop: shopId,
    type: WALLET_TRANSACTION_TYPE.DEBIT,
    grossAmount: request.amount,
    platformFee: 0,
    netAmount: request.amount,
    description: `Rút tiền lệnh #${withdrawalId}`,
    metadata: { withdrawalId },
  })

  return updated
}
