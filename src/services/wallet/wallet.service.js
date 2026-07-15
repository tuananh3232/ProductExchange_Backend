import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { WALLET_TRANSACTION_TYPE, WITHDRAWAL_STATUS } from '../../constants/status.constant.js'
import { WALLET_CONSTANTS } from '../../constants/wallet.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { assertShopPermission } from '../../utils/data-scope.util.js'
import { sanitizeWithdrawalListItem } from '../../utils/security.util.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import PERMISSIONS from '../../constants/permission.constant.js'
import * as walletRepo from '../../repositories/wallet/wallet.repository.js'
import * as withdrawalRepo from '../../repositories/withdrawal-request/withdrawal-request.repository.js'
import Shop from '../../models/shop.model.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'

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
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.SHOP_WALLET_READ })

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
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.SHOP_WALLET_TRANSACTION_READ })

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

  return runRequiredMongoTransaction(async (session) => {
    const wallet = await walletRepo.findOrCreateByShop(shopId).session(session)
    const updatedWallet = await walletRepo.deductForWithdrawal(shopId, payload.amount, { session })
    if (!updatedWallet) {
      throw new AppError('Số dư không đủ để thực hiện lệnh rút', HTTP_STATUS.BAD_REQUEST, ERRORS.WALLET.INSUFFICIENT_BALANCE)
    }
    const withdrawal = await withdrawalRepo.create({
      shop: shopId,
      wallet: wallet._id,
      requestedBy: userContext._id,
      amount: payload.amount,
      bankInfo: payload.bankInfo,
      note: payload.note || '',
    }, { session })
    await postBalancedTransaction({
      commandKey: `shop_withdrawal_reserve:${withdrawal._id}`,
      transactionType: 'withdrawal_reserve',
      referenceType: 'WithdrawalRequest',
      referenceId: withdrawal._id,
      entries: [
        { account: accountDefinitions.shopAvailable(shopId), direction: 'debit', amount: payload.amount },
        { account: accountDefinitions.withdrawalPending(withdrawal._id, 'shop', shopId), direction: 'credit', amount: payload.amount },
      ],
    }, session)
    return withdrawal
  })
}

export const getWithdrawals = async (shopId, userContext, pagination, statusFilter) => {
  await assertShopPermission({ user: userContext, shopId, permissionKey: PERMISSIONS.SHOP_WITHDRAWAL_READ })

  const filter = { shop: shopId }
  if (statusFilter) filter.status = statusFilter
  return queryWithdrawals(filter, pagination)
}

export const adminGetWithdrawals = async (pagination, statusFilter) => {
  const filter = {}
  if (statusFilter) filter.status = statusFilter
  const result = await queryWithdrawals(filter, pagination)
  return {
    ...result,
    withdrawals: result.withdrawals.map(sanitizeWithdrawalListItem),
  }
}

export const adminGetWithdrawalById = async (withdrawalId) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  return request
}

export const approveWithdrawal = async (withdrawalId, userContext) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Lệnh rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }

  const updated = await withdrawalRepo.transition(withdrawalId, [WITHDRAWAL_STATUS.PENDING], {
    status: WITHDRAWAL_STATUS.APPROVED,
    approvedBy: userContext._id,
    approvedAt: new Date(),
  })
  if (!updated) throw new AppError('Lệnh rút tiền đã được xử lý', HTTP_STATUS.CONFLICT, ERRORS.WITHDRAWAL.INVALID_STATUS)

  await writeAuditLog({
    adminId: userContext._id,
    action: 'SHOP_WITHDRAWAL_APPROVED',
    targetType: 'withdrawal',
    targetId: request._id,
    previousStatus: request.status,
    newStatus: WITHDRAWAL_STATUS.APPROVED,
    metadata: { shopId: request.shop?._id || request.shop, amount: request.amount },
  })

  return updated
}

export const rejectWithdrawal = async (withdrawalId, userContext, rejectionReason, adminNote = '') => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.PENDING) {
    throw new AppError('Lệnh rút tiền không ở trạng thái chờ duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }

  const shopId = request.shop?._id || request.shop
  const updated = await runRequiredMongoTransaction(async (session) => {
    const options = { session }
    const updated = await withdrawalRepo.transition(withdrawalId, [WITHDRAWAL_STATUS.PENDING], {
      status: WITHDRAWAL_STATUS.REJECTED,
      rejectionReason,
      adminNote,
      approvedBy: userContext._id,
      approvedAt: new Date(),
    }, options)
    if (!updated) throw new AppError('Lệnh rút tiền đã được xử lý', HTTP_STATUS.CONFLICT, ERRORS.WITHDRAWAL.INVALID_STATUS)

    const wallet = await walletRepo.revertWithdrawal(shopId, request.amount, options)
    if (!wallet) throw new AppError('Số dư đang chờ không hợp lệ', HTTP_STATUS.CONFLICT, 'WITHDRAWAL_PENDING_BALANCE_MISMATCH')
    await postBalancedTransaction({
      commandKey: `shop_withdrawal_reject:${request._id}`,
      transactionType: 'withdrawal_reject',
      referenceType: 'WithdrawalRequest',
      referenceId: request._id,
      entries: [
        { account: accountDefinitions.withdrawalPending(request._id, 'shop', shopId), direction: 'debit', amount: request.amount },
        { account: accountDefinitions.shopAvailable(shopId), direction: 'credit', amount: request.amount },
      ],
    }, session)
    return updated
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'SHOP_WITHDRAWAL_REJECTED',
    targetType: 'withdrawal',
    targetId: request._id,
    previousStatus: request.status,
    newStatus: WITHDRAWAL_STATUS.REJECTED,
    reason: rejectionReason,
    adminNote,
    metadata: { shopId, amount: request.amount },
  })

  return updated
}

export const completeWithdrawal = async (withdrawalId, userContext, adminNote = '', transferProof) => {
  const request = await getWithdrawalOrThrow(withdrawalId)
  if (request.status !== WITHDRAWAL_STATUS.APPROVED) {
    throw new AppError('Lệnh rút tiền chưa được duyệt', HTTP_STATUS.BAD_REQUEST, ERRORS.WITHDRAWAL.INVALID_STATUS)
  }
  if (String(request.approvedBy?._id || request.approvedBy) === String(userContext._id)) {
    throw new AppError('Người duyệt không được tự xác nhận hoàn tất', HTTP_STATUS.FORBIDDEN, 'WITHDRAWAL_MAKER_CHECKER_REQUIRED')
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

  const updated = await runRequiredMongoTransaction(async (session) => {
    const options = { session }
    const updated = await withdrawalRepo.transition(withdrawalId, [WITHDRAWAL_STATUS.APPROVED], update, options)
    if (!updated) throw new AppError('Lệnh rút tiền đã được xử lý', HTTP_STATUS.CONFLICT, ERRORS.WITHDRAWAL.INVALID_STATUS)

    const wallet = await walletRepo.completeWithdrawal(shopId, request.amount, options)
    if (!wallet) throw new AppError('Số dư đang chờ không hợp lệ', HTTP_STATUS.CONFLICT, 'WITHDRAWAL_PENDING_BALANCE_MISMATCH')

    await walletRepo.createTransaction({
      wallet: request.wallet,
      shop: shopId,
      type: WALLET_TRANSACTION_TYPE.DEBIT,
      grossAmount: request.amount,
      platformFee: 0,
      netAmount: request.amount,
      metadata: { withdrawalId },
    }, options)

    await postBalancedTransaction({
      commandKey: `shop_withdrawal_payout:${request._id}`,
      transactionType: 'withdrawal_payout',
      referenceType: 'WithdrawalRequest',
      referenceId: request._id,
      entries: [
        { account: accountDefinitions.withdrawalPending(request._id, 'shop', shopId), direction: 'debit', amount: request.amount },
        { account: accountDefinitions.providerClearing('payout'), direction: 'credit', amount: request.amount },
      ],
    }, session)

    return updated
  })

  await writeAuditLog({
    adminId: userContext._id,
    action: 'SHOP_WITHDRAWAL_COMPLETED',
    targetType: 'withdrawal',
    targetId: request._id,
    previousStatus: request.status,
    newStatus: WITHDRAWAL_STATUS.COMPLETED,
    adminNote,
    metadata: { shopId, amount: request.amount, transferProof },
  })

  return updated
}
