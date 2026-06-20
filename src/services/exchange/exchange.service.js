import ExchangeOffer from '../../models/exchange-offer.model.js'
import Product from '../../models/product.model.js'
import PlatformWallet from '../../models/platform-wallet.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import LedgerEntry from '../../models/ledger-entry.model.js'
import FeeSnapshot from '../../models/fee-snapshot.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { previewFee } from '../fee-policy/fee-policy.service.js'
import { getExchangeEligibility } from './exchange-eligibility.service.js'
import { FEE_BASE_AMOUNT_TYPE } from '../../constants/fee.constant.js'
import { EXCHANGE_STATUS, USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import {
  LEDGER_ENTRY_DIRECTION,
  LEDGER_REFERENCE_TYPE,
  LEDGER_TRANSACTION_TYPE,
  PLATFORM_WALLET_KEYS,
} from '../../constants/ledger.constant.js'
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js'
import { notifySafely } from '../notification/notification.service.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'

const EXCHANGE_LIST_POPULATE = [
  { path: 'requesterSeller', select: 'name email avatar' },
  { path: 'receiverSeller', select: 'name email avatar' },
  { path: 'requesterProduct', select: 'title price status images seller shop ownerType' },
  { path: 'receiverProduct', select: 'title price status images seller shop ownerType' },
]

const notifyExchange = (recipient, type, exchangeOffer, message, sender = null) =>
  notifySafely({
    recipient,
    sender,
    type,
    title: 'Cập nhật trao đổi',
    message,
    targetType: NOTIFICATION_TARGET_TYPES.EXCHANGE,
    targetId: exchangeOffer._id,
    actionUrl: `/seller/exchanges/${exchangeOffer._id}`,
    data: { exchangeOfferId: exchangeOffer._id },
  })

const mutatePlatformWallet = async (walletKey, direction, amount) => {
  const inc =
    direction === LEDGER_ENTRY_DIRECTION.CREDIT
      ? { balance: amount, totalIn: amount }
      : { balance: -amount, totalOut: amount }

  return PlatformWallet.findOneAndUpdate(
    { walletKey },
    { $inc: inc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}

const buildExchangeFeePreview = async (exchangeTerms, categoryId) => {
  if (!exchangeTerms.cashDifferenceAmount) {
    return {
      feePolicyId: null,
      transactionType: 'EXCHANGE',
      ownerType: 'SELLER',
      categoryId: categoryId || null,
      baseAmountType: FEE_BASE_AMOUNT_TYPE.EXCHANGE_CASH_DIFFERENCE,
      rounding: 'ROUND',
      percent: 0,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee: 0,
      baseAmount: 0,
      netAmount: 0,
    }
  }

  try {
    return await previewFee({
      transactionType: 'EXCHANGE',
      ownerType: 'SELLER',
      categoryId: categoryId || null,
      baseAmount: exchangeTerms.cashDifferenceAmount,
      transactionCreatedAt: new Date(),
    })
  } catch {
    const calculatedFee = Math.round(exchangeTerms.cashDifferenceAmount * 0.05)
    return {
      feePolicyId: null,
      transactionType: 'EXCHANGE',
      ownerType: 'SELLER',
      categoryId: categoryId || null,
      baseAmountType: FEE_BASE_AMOUNT_TYPE.EXCHANGE_CASH_DIFFERENCE,
      rounding: 'ROUND',
      percent: 5,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee,
      baseAmount: exchangeTerms.cashDifferenceAmount,
      netAmount: Math.max(0, exchangeTerms.cashDifferenceAmount - calculatedFee),
    }
  }
}

const appendTimeline = (exchangeOffer, status, userId, note = '') => {
  exchangeOffer.timeline = [
    ...(exchangeOffer.timeline || []),
    {
      status,
      note,
      updatedBy: userId,
      updatedAt: new Date(),
    },
  ]
}

const getLastTimelineActorId = (exchangeOffer) => {
  const timeline = exchangeOffer.timeline || []
  if (!timeline.length) return null
  return timeline[timeline.length - 1]?.updatedBy || null
}

const isParticipant = (exchangeOffer, userId) =>
  [exchangeOffer.requesterSeller, exchangeOffer.receiverSeller].some((value) => String(value) === String(userId))

const isRequester = (exchangeOffer, userId) => String(exchangeOffer.requesterSeller) === String(userId)
const getExchangeOfferOrThrow = async (exchangeOfferId) => {
  const exchangeOffer = await ExchangeOffer.findById(exchangeOfferId)

  if (!exchangeOffer || !exchangeOffer.isActive) {
    throw new AppError('Không tìm thấy đề nghị trao đổi', HTTP_STATUS.NOT_FOUND, ERRORS.EXCHANGE.NOT_FOUND)
  }

  return exchangeOffer
}

const populateExchangeOffer = (query) => EXCHANGE_LIST_POPULATE.reduce((current, item) => current.populate(item), query)

const getPopulatedExchangeOfferById = async (exchangeOfferId) => {
  const query = ExchangeOffer.findById(exchangeOfferId)
  const exchangeOffer = await populateExchangeOffer(query)

  if (!exchangeOffer || !exchangeOffer.isActive) {
    throw new AppError('Không tìm thấy đề nghị trao đổi', HTTP_STATUS.NOT_FOUND, ERRORS.EXCHANGE.NOT_FOUND)
  }

  return exchangeOffer
}

const assertParticipant = (exchangeOffer, userId) => {
  if (!isParticipant(exchangeOffer, userId)) {
    throw new AppError('Bạn không thuộc giao dịch trao đổi này', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.INVALID_PARTICIPANT)
  }
}

const assertStatusIn = (exchangeOffer, statuses) => {
  if (!statuses.includes(exchangeOffer.status)) {
    throw new AppError('Không thể thực hiện hành động ở trạng thái trao đổi hiện tại', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.INVALID_STATUS_TRANSITION)
  }
}

const assertWaitingForCurrentUserDecision = (exchangeOffer, userId) => {
  const lastActorId = getLastTimelineActorId(exchangeOffer)
  if (lastActorId && String(lastActorId) === String(userId)) {
    throw new AppError('Đang chờ phía còn lại phản hồi cho đề nghị trao đổi này', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.INVALID_STATUS_TRANSITION)
  }
}

const buildFeeSnapshotPayload = (exchangeOffer, preview, baseAmount) => ({
  sourceType: 'exchange',
  sourceId: exchangeOffer._id,
  feePolicyId: preview.feePolicyId || null,
  transactionType: preview.transactionType,
  ownerType: preview.ownerType,
  categoryId: preview.categoryId || null,
  baseAmountType: preview.baseAmountType,
  rounding: preview.rounding,
  baseAmount,
  percent: preview.percent,
  fixedFee: preview.fixedFee || 0,
  minFee: preview.minFee || 0,
  maxFee: preview.maxFee ?? null,
  calculatedFee: preview.calculatedFee,
  netAmount: preview.netAmount,
  effectiveFrom: new Date(),
  effectiveTo: null,
  lockedAt: new Date(),
})

const holdExchangePayment = async (exchangeOffer, payerUserId, amountDue) => {
  if (!amountDue) {
    return null
  }

  const existing = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
    referenceId: exchangeOffer._id,
    transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_PAYMENT_HOLD,
  })

  if (existing) {
    return existing
  }

  const walletBefore = await userWalletRepo.findByUser(payerUserId)
  const balanceBefore = walletBefore?.balance || 0
  const payerWallet = await userWalletRepo.deductForExchange(payerUserId, amountDue)

  if (!payerWallet) {
    throw new AppError('Số dư ví không đủ để thanh toán tiền bù trao đổi', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
  }

  const walletTx = await userWalletRepo.createTransaction({
    wallet: payerWallet._id,
    user: payerUserId,
    type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_PAYMENT,
    amount: amountDue,
    balanceBefore,
    balanceAfter: payerWallet.balance,
    description: `Thanh toán tiền bù trao đổi #${exchangeOffer._id}`,
    metadata: { exchangeOfferId: exchangeOffer._id },
  })

  const holdTxDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_PAYMENT_HOLD,
      referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
      referenceId: exchangeOffer._id,
      grossAmount: amountDue,
      platformFee: exchangeOffer.platformFee,
      netSettlementAmount: exchangeOffer.cashDifferenceAmount,
      settlementStatus: exchangeOffer.cashDifferenceAmount > 0 ? 'held' : 'settled',
      source: 'exchange_wallet_payment',
      description: `Hold exchange payment for offer ${exchangeOffer._id}`,
      metadata: {
        payerUserId,
        walletTransactionId: walletTx._id,
      },
    },
  ])

  const holdTx = holdTxDocs[0]
  const clearingWallet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, amountDue)

  await LedgerEntry.create({
    ledgerTransaction: holdTx._id,
    walletKey: PLATFORM_WALLET_KEYS.CLEARING,
    direction: LEDGER_ENTRY_DIRECTION.CREDIT,
    amount: amountDue,
    balanceAfter: clearingWallet.balance,
    counterpartyType: 'exchange_payer_wallet',
    counterpartyId: payerUserId,
    note: 'Hold exchange difference and fee in platform clearing wallet',
    metadata: { exchangeOfferId: exchangeOffer._id },
  })

  return holdTx
}

const releaseExchangeSettlement = async (exchangeOffer, adminId = null) => {
  const existing = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
    referenceId: exchangeOffer._id,
    transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT_RELEASE,
  })

  if (existing) {
    return existing
  }

  const amountDue = exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee
  const releaseTxDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT_RELEASE,
      referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
      referenceId: exchangeOffer._id,
      grossAmount: amountDue,
      platformFee: exchangeOffer.platformFee,
      netSettlementAmount: exchangeOffer.cashDifferenceAmount,
      settlementStatus: 'settled',
      source: adminId ? 'admin_exchange_resolution' : 'exchange_completion',
      description: `Release exchange settlement for offer ${exchangeOffer._id}`,
      metadata: {
        receiverUserId: exchangeOffer.cashDifferenceReceiver,
        adminId,
      },
    },
  ])

  const releaseTx = releaseTxDocs[0]
  const entries = []

  if (exchangeOffer.platformFee > 0) {
    const clearingAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, exchangeOffer.platformFee)
    entries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: exchangeOffer.platformFee,
      balanceAfter: clearingAfterFee.balance,
      counterpartyType: 'platform_revenue',
      note: 'Move exchange fee out of clearing wallet',
      metadata: { exchangeOfferId: exchangeOffer._id },
    })

    const revenueAfterFee = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.REVENUE, LEDGER_ENTRY_DIRECTION.CREDIT, exchangeOffer.platformFee)
    entries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.REVENUE,
      direction: LEDGER_ENTRY_DIRECTION.CREDIT,
      amount: exchangeOffer.platformFee,
      balanceAfter: revenueAfterFee.balance,
      counterpartyType: 'exchange_platform_fee',
      note: 'Recognize exchange fee revenue',
      metadata: { exchangeOfferId: exchangeOffer._id },
    })
  }

  if (exchangeOffer.cashDifferenceAmount > 0 && exchangeOffer.cashDifferenceReceiver) {
    const receiverWalletBefore = await userWalletRepo.findByUser(exchangeOffer.cashDifferenceReceiver)
    const balanceBefore = receiverWalletBefore?.balance || 0
    const receiverWallet = await userWalletRepo.creditExchangeSettlement(exchangeOffer.cashDifferenceReceiver, exchangeOffer.cashDifferenceAmount)
    const clearingAfterSettlement = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, exchangeOffer.cashDifferenceAmount)

    entries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: exchangeOffer.cashDifferenceAmount,
      balanceAfter: clearingAfterSettlement.balance,
      counterpartyType: 'exchange_receiver_wallet',
      counterpartyId: exchangeOffer.cashDifferenceReceiver,
      note: 'Release exchange cash difference to receiver wallet',
      metadata: { exchangeOfferId: exchangeOffer._id },
    })

    await userWalletRepo.createTransaction({
      wallet: receiverWallet._id,
      user: exchangeOffer.cashDifferenceReceiver,
      type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT,
      amount: exchangeOffer.cashDifferenceAmount,
      balanceBefore,
      balanceAfter: receiverWallet.balance,
      description: `Nhận tiền bù trao đổi #${exchangeOffer._id}`,
      metadata: { exchangeOfferId: exchangeOffer._id },
    })
  }

  if (entries.length) {
    await LedgerEntry.insertMany(entries)
  }

  return releaseTx
}

const refundExchangeHold = async (exchangeOffer, reason, actorUserId = null) => {
  const holdTx = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
    referenceId: exchangeOffer._id,
    transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_PAYMENT_HOLD,
  })

  if (!holdTx) {
    return null
  }

  const existingRefund = await LedgerTransaction.findOne({
    referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
    referenceId: exchangeOffer._id,
    transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_REFUND,
  })

  if (existingRefund) {
    return existingRefund
  }

  const refundTxDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_REFUND,
      referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
      referenceId: exchangeOffer._id,
      grossAmount: holdTx.grossAmount,
      platformFee: exchangeOffer.platformFee,
      netSettlementAmount: exchangeOffer.cashDifferenceAmount,
      settlementStatus: 'refunded',
      source: 'exchange_refund',
      description: `Refund exchange hold for offer ${exchangeOffer._id}`,
      metadata: {
        payerUserId: exchangeOffer.cashDifferencePayer,
        reason,
        actorUserId,
      },
    },
  ])

  const refundTx = refundTxDocs[0]
  const payerWalletBefore = await userWalletRepo.findByUser(exchangeOffer.cashDifferencePayer)
  const balanceBefore = payerWalletBefore?.balance || 0
  const payerWallet = await userWalletRepo.refundFromExchange(exchangeOffer.cashDifferencePayer, holdTx.grossAmount)
  const clearingAfterRefund = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.DEBIT, holdTx.grossAmount)

  await LedgerEntry.create({
    ledgerTransaction: refundTx._id,
    walletKey: PLATFORM_WALLET_KEYS.CLEARING,
    direction: LEDGER_ENTRY_DIRECTION.DEBIT,
    amount: holdTx.grossAmount,
    balanceAfter: clearingAfterRefund.balance,
    counterpartyType: 'exchange_refund_wallet',
    counterpartyId: exchangeOffer.cashDifferencePayer,
    note: 'Refund exchange hold back to payer wallet',
    metadata: { exchangeOfferId: exchangeOffer._id },
  })

  await userWalletRepo.createTransaction({
    wallet: payerWallet._id,
    user: exchangeOffer.cashDifferencePayer,
    type: USER_WALLET_TRANSACTION_TYPE.EXCHANGE_REFUND,
    amount: holdTx.grossAmount,
    balanceBefore,
    balanceAfter: payerWallet.balance,
    description: `Hoàn tiền bù trao đổi #${exchangeOffer._id}`,
    metadata: { exchangeOfferId: exchangeOffer._id, reason },
  })

  return refundTx
}

const mapOfferPayload = async ({ requesterProductId, receiverProductId, note, currentUserId, ignoreExchangeId = null }) => {
  const eligibility = await getExchangeEligibility({
    requesterProductId,
    receiverProductId,
    currentUserId,
    ignoreExchangeId,
  })

  const feePreview = await buildExchangeFeePreview(eligibility.terms, eligibility.receiverProduct.category?._id || eligibility.receiverProduct.category || null)

  return {
    requesterSeller: eligibility.requesterProduct.seller,
    receiverSeller: eligibility.receiverProduct.seller,
    requesterProduct: eligibility.requesterProduct._id,
    receiverProduct: eligibility.receiverProduct._id,
    requesterProductValue: eligibility.terms.requesterProductValue,
    receiverProductValue: eligibility.terms.receiverProductValue,
    cashDifferenceAmount: eligibility.terms.cashDifferenceAmount,
    cashDifferenceDirection: eligibility.terms.cashDifferenceDirection,
    cashDifferencePayer: eligibility.terms.cashDifferencePayer,
    cashDifferenceReceiver: eligibility.terms.cashDifferenceReceiver,
    feePolicyId: feePreview.feePolicyId || null,
    platformFee: feePreview.calculatedFee,
    note: note || '',
    feePreview,
  }
}

export const createExchangeOffer = async (payload, userContext) => {
  const mapped = await mapOfferPayload({
    requesterProductId: payload.requesterProductId,
    receiverProductId: payload.receiverProductId,
    note: payload.note,
    currentUserId: userContext._id,
  })

  const exchangeOffer = await ExchangeOffer.create({
    ...mapped,
    status: EXCHANGE_STATUS.PENDING_ACCEPTANCE,
    timeline: [
      {
        status: EXCHANGE_STATUS.PENDING_ACCEPTANCE,
        note: payload.note || 'Tạo đề nghị trao đổi',
        updatedBy: userContext._id,
        updatedAt: new Date(),
      },
    ],
  })

  if (mapped.feePreview) {
    const feeSnapshot = await FeeSnapshot.create(buildFeeSnapshotPayload(exchangeOffer, mapped.feePreview, mapped.cashDifferenceAmount))
    exchangeOffer.feeSnapshotId = feeSnapshot._id
    await exchangeOffer.save()
  }

  await notifyExchange(mapped.receiverSeller, NOTIFICATION_TYPES.EXCHANGE_OFFER_CREATED, exchangeOffer, 'Bạn vừa nhận được một đề nghị trao đổi mới', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const listMyExchangeOffers = async (userContext, query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = {
    isActive: true,
    $or: [{ requesterSeller: userContext._id }, { receiverSeller: userContext._id }],
  }

  if (query.status) {
    filter.status = query.status
  }

  const [exchangeOffers, total] = await Promise.all([
    populateExchangeOffer(
      ExchangeOffer.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
    ),
    ExchangeOffer.countDocuments(filter),
  ])

  return {
    exchangeOffers,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getMyExchangeOfferById = async (exchangeOfferId, userContext) => {
  const exchangeOffer = await getPopulatedExchangeOfferById(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  return exchangeOffer
}

export const counterExchangeOffer = async (exchangeOfferId, payload, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.PENDING_ACCEPTANCE, EXCHANGE_STATUS.ACCEPTED])
  assertWaitingForCurrentUserDecision(exchangeOffer, userContext._id)

  const requesterProductId = payload.requesterProductId || exchangeOffer.requesterProduct
  const receiverProductId = payload.receiverProductId || exchangeOffer.receiverProduct
  const mapped = await mapOfferPayload({
    requesterProductId,
    receiverProductId,
    note: payload.note,
    currentUserId: exchangeOffer.requesterSeller,
    ignoreExchangeId: exchangeOffer._id,
  })

  if (
    String(mapped.requesterSeller) !== String(exchangeOffer.requesterSeller) ||
    String(mapped.receiverSeller) !== String(exchangeOffer.receiverSeller)
  ) {
    throw new AppError('Không thể counter sang sản phẩm của seller khác', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.INVALID_PARTICIPANT)
  }

  Object.assign(exchangeOffer, mapped, {
    status: EXCHANGE_STATUS.PENDING_ACCEPTANCE,
    acceptedAt: null,
    paidAt: null,
    requesterShippedAt: null,
    receiverShippedAt: null,
    requesterReceivedAt: null,
    receiverReceivedAt: null,
    completedAt: null,
    disputeOpenedAt: null,
    disputeOpenedBy: null,
    disputeReason: '',
    resolvedAt: null,
    resolvedByAdmin: null,
    resolution: 'none',
    resolutionNote: '',
  })
  appendTimeline(exchangeOffer, EXCHANGE_STATUS.PENDING_ACCEPTANCE, userContext._id, payload.note || 'Counter đề nghị trao đổi')

  if (exchangeOffer.feeSnapshotId) {
    await FeeSnapshot.findByIdAndDelete(exchangeOffer.feeSnapshotId)
  }

  const feeSnapshot = await FeeSnapshot.create(buildFeeSnapshotPayload(exchangeOffer, mapped.feePreview, mapped.cashDifferenceAmount))
  exchangeOffer.feeSnapshotId = feeSnapshot._id
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_COUNTERED, exchangeOffer, 'Đề nghị trao đổi đã được counter', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const acceptExchangeOffer = async (exchangeOfferId, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.PENDING_ACCEPTANCE])
  assertWaitingForCurrentUserDecision(exchangeOffer, userContext._id)

  exchangeOffer.status = exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee > 0 ? EXCHANGE_STATUS.ACCEPTED : EXCHANGE_STATUS.PAID
  exchangeOffer.acceptedAt = new Date()
  if (exchangeOffer.status === EXCHANGE_STATUS.PAID) {
    exchangeOffer.paidAt = new Date()
  }
  appendTimeline(exchangeOffer, exchangeOffer.status, userContext._id, 'Chấp nhận đề nghị trao đổi')
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_ACCEPTED, exchangeOffer, 'Đề nghị trao đổi đã được chấp nhận', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const payExchangeDifference = async (exchangeOfferId, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.ACCEPTED])

  if (!exchangeOffer.cashDifferencePayer || String(exchangeOffer.cashDifferencePayer) !== String(userContext._id)) {
    throw new AppError('Bạn không phải bên trả tiền bù cho giao dịch trao đổi này', HTTP_STATUS.FORBIDDEN, ERRORS.EXCHANGE.INVALID_PARTICIPANT)
  }

  if (exchangeOffer.paidAt) {
    throw new AppError('Khoản tiền bù trao đổi đã được thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.ALREADY_PAID)
  }

  const amountDue = exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee
  await holdExchangePayment(exchangeOffer, userContext._id, amountDue)

  exchangeOffer.status = EXCHANGE_STATUS.PAID
  exchangeOffer.paidAt = new Date()
  appendTimeline(exchangeOffer, EXCHANGE_STATUS.PAID, userContext._id, 'Đã thanh toán tiền bù và phí trao đổi')
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_PAID, exchangeOffer, 'Tiền bù trao đổi đã được thanh toán', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const markExchangeShipped = async (exchangeOfferId, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.PAID, EXCHANGE_STATUS.SHIPPED])

  if (!exchangeOffer.paidAt && exchangeOffer.cashDifferenceAmount + exchangeOffer.platformFee > 0) {
    throw new AppError('Giao dịch trao đổi chưa hoàn tất bước thanh toán tiền bù', HTTP_STATUS.BAD_REQUEST, ERRORS.EXCHANGE.PAYMENT_REQUIRED)
  }

  if (isRequester(exchangeOffer, userContext._id)) {
    exchangeOffer.requesterShippedAt = exchangeOffer.requesterShippedAt || new Date()
  } else {
    exchangeOffer.receiverShippedAt = exchangeOffer.receiverShippedAt || new Date()
  }

  if (exchangeOffer.requesterShippedAt && exchangeOffer.receiverShippedAt) {
    exchangeOffer.status = EXCHANGE_STATUS.SHIPPED
  }

  appendTimeline(exchangeOffer, exchangeOffer.status, userContext._id, 'Đã xác nhận gửi hàng trao đổi')
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_SHIPPED, exchangeOffer, 'Đối tác đã xác nhận gửi hàng trao đổi', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const confirmExchangeReceived = async (exchangeOfferId, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.SHIPPED, EXCHANGE_STATUS.PAID])

  if (isRequester(exchangeOffer, userContext._id)) {
    exchangeOffer.requesterReceivedAt = exchangeOffer.requesterReceivedAt || new Date()
  } else {
    exchangeOffer.receiverReceivedAt = exchangeOffer.receiverReceivedAt || new Date()
  }

  if (exchangeOffer.requesterReceivedAt && exchangeOffer.receiverReceivedAt) {
    await releaseExchangeSettlement(exchangeOffer)
    exchangeOffer.status = EXCHANGE_STATUS.COMPLETED
    exchangeOffer.completedAt = new Date()
  }

  appendTimeline(exchangeOffer, exchangeOffer.status, userContext._id, 'Đã xác nhận nhận hàng trao đổi')
  await exchangeOffer.save()

  if (exchangeOffer.status === EXCHANGE_STATUS.COMPLETED) {
    await Promise.all([
      Product.findByIdAndUpdate(exchangeOffer.requesterProduct, { status: 'sold' }),
      Product.findByIdAndUpdate(exchangeOffer.receiverProduct, { status: 'sold' }),
      notifyExchange(exchangeOffer.requesterSeller, NOTIFICATION_TYPES.EXCHANGE_COMPLETED, exchangeOffer, 'Trao đổi đã hoàn tất', userContext._id),
      notifyExchange(exchangeOffer.receiverSeller, NOTIFICATION_TYPES.EXCHANGE_COMPLETED, exchangeOffer, 'Trao đổi đã hoàn tất', userContext._id),
    ])
  }

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const cancelExchangeOffer = async (exchangeOfferId, payload, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.PENDING_ACCEPTANCE, EXCHANGE_STATUS.ACCEPTED, EXCHANGE_STATUS.PAID])

  if (exchangeOffer.paidAt) {
    await refundExchangeHold(exchangeOffer, payload.reason || payload.note || 'Exchange cancelled', userContext._id)
  }

  exchangeOffer.status = EXCHANGE_STATUS.CANCELLED
  exchangeOffer.cancelledAt = new Date()
  appendTimeline(exchangeOffer, EXCHANGE_STATUS.CANCELLED, userContext._id, payload.note || payload.reason || 'Hủy đề nghị trao đổi')
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_CANCELLED, exchangeOffer, 'Đề nghị trao đổi đã bị hủy', userContext._id)

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const openExchangeDispute = async (exchangeOfferId, payload, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertParticipant(exchangeOffer, userContext._id)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.PAID, EXCHANGE_STATUS.SHIPPED])

  exchangeOffer.status = EXCHANGE_STATUS.DISPUTED
  exchangeOffer.disputeOpenedAt = new Date()
  exchangeOffer.disputeOpenedBy = userContext._id
  exchangeOffer.disputeReason = payload.reason
  appendTimeline(exchangeOffer, EXCHANGE_STATUS.DISPUTED, userContext._id, payload.reason)
  await exchangeOffer.save()

  const recipient = isRequester(exchangeOffer, userContext._id) ? exchangeOffer.receiverSeller : exchangeOffer.requesterSeller
  await Promise.all([
    notifyExchange(recipient, NOTIFICATION_TYPES.EXCHANGE_DISPUTED, exchangeOffer, 'Đối tác đã mở tranh chấp cho giao dịch trao đổi này', userContext._id),
    writeAuditLog({
      adminId: null,
      action: 'EXCHANGE_DISPUTE_OPENED',
      targetType: 'exchange',
      targetId: exchangeOffer._id,
      newStatus: EXCHANGE_STATUS.DISPUTED,
      reason: payload.reason,
      metadata: { openedBy: userContext._id },
    }),
  ])

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}

export const getAdminExchangeOffers = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }
  if (query.status) filter.status = query.status
  if (query.onlyDisputed) filter.status = EXCHANGE_STATUS.DISPUTED
  if (query.sellerId) {
    filter.$or = [{ requesterSeller: query.sellerId }, { receiverSeller: query.sellerId }]
  }

  const [exchangeOffers, total] = await Promise.all([
    populateExchangeOffer(
      ExchangeOffer.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
    ),
    ExchangeOffer.countDocuments(filter),
  ])

  return {
    exchangeOffers,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getAdminExchangeOfferById = async (exchangeOfferId) => getPopulatedExchangeOfferById(exchangeOfferId)

export const resolveAdminExchangeDispute = async (exchangeOfferId, payload, userContext) => {
  const exchangeOffer = await getExchangeOfferOrThrow(exchangeOfferId)
  assertStatusIn(exchangeOffer, [EXCHANGE_STATUS.DISPUTED])

  if (payload.resolution === 'complete') {
    await releaseExchangeSettlement(exchangeOffer, userContext._id)
    exchangeOffer.status = EXCHANGE_STATUS.COMPLETED
    exchangeOffer.completedAt = new Date()
    await Promise.all([
      Product.findByIdAndUpdate(exchangeOffer.requesterProduct, { status: 'sold' }),
      Product.findByIdAndUpdate(exchangeOffer.receiverProduct, { status: 'sold' }),
    ])
  } else {
    await refundExchangeHold(exchangeOffer, payload.note || 'Admin resolved dispute with cancel/refund', userContext._id)
    exchangeOffer.status = EXCHANGE_STATUS.CANCELLED
    exchangeOffer.cancelledAt = new Date()
  }

  exchangeOffer.resolution = payload.resolution
  exchangeOffer.resolutionNote = payload.note || ''
  exchangeOffer.resolvedAt = new Date()
  exchangeOffer.resolvedByAdmin = userContext._id
  appendTimeline(exchangeOffer, exchangeOffer.status, userContext._id, payload.note || 'Admin resolved exchange dispute')
  await exchangeOffer.save()

  await writeAuditLog({
    adminId: userContext._id,
    action: 'EXCHANGE_DISPUTE_RESOLVED',
    targetType: 'exchange',
    targetId: exchangeOffer._id,
    previousStatus: EXCHANGE_STATUS.DISPUTED,
    newStatus: exchangeOffer.status,
    adminNote: payload.note || '',
    metadata: { resolution: payload.resolution },
  })

  await Promise.all([
    notifyExchange(exchangeOffer.requesterSeller, NOTIFICATION_TYPES.EXCHANGE_RESOLVED, exchangeOffer, 'Tranh chấp trao đổi đã được admin xử lý', userContext._id),
    notifyExchange(exchangeOffer.receiverSeller, NOTIFICATION_TYPES.EXCHANGE_RESOLVED, exchangeOffer, 'Tranh chấp trao đổi đã được admin xử lý', userContext._id),
  ])

  return getPopulatedExchangeOfferById(exchangeOffer._id)
}
