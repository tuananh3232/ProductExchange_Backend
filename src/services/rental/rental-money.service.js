import FeeSnapshot from '../../models/fee-snapshot.model.js'
import RentalBooking from '../../models/rental-booking.model.js'
import RentalClaim from '../../models/rental-claim.model.js'
import UserWallet from '../../models/user-wallet.model.js'
import UserWalletTransaction from '../../models/user-wallet-transaction.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { RENTAL_BOOKING_STATUS, RENTAL_CLAIM_STATUS, USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import { runRequiredMongoTransaction } from '../../utils/mongo-transaction.util.js'
import { accountDefinitions, postBalancedTransaction } from '../accounting/accounting.service.js'
import { previewFee } from '../fee-policy/fee-policy.service.js'
import { writeAuditLog } from '../audit/audit-log.service.js'

const OPEN_CLAIM_STATUSES = [
  RENTAL_CLAIM_STATUS.OPEN,
  RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW,
  RENTAL_CLAIM_STATUS.WAITING_RENTER_RESPONSE,
]

const populateBooking = (query) => query
  .populate({ path: 'product', select: 'title category' })
  .populate({ path: 'renter', select: 'name email avatar' })
  .populate({ path: 'seller', select: 'name email avatar' })
  .populate({ path: 'shop', select: 'name slug owner' })

const getBooking = async (bookingId) => {
  const booking = await populateBooking(RentalBooking.findById(bookingId))
  if (!booking || !booking.isActive) {
    throw new AppError('Không tìm thấy booking cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.BOOKING_NOT_FOUND)
  }
  return booking
}

const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const diffDaysInclusive = (start, end) => Math.max(
  1,
  Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1
)

const appendTimeline = (booking, status, userId, note = '') => {
  booking.timeline.push({ status, note, updatedBy: userId, updatedAt: new Date() })
}

const ownerIdOf = (booking) => booking.ownerType === 'SHOP'
  ? booking.shop?.owner?._id || booking.shop?.owner
  : booking.seller?._id || booking.seller

const walletActivity = async ({ wallet, user, type, amount, before, after, bookingId, claimId, description }, session) => {
  if (amount <= 0) return
  await UserWalletTransaction.create([{
    wallet,
    user,
    type,
    amount,
    balanceBefore: before,
    balanceAfter: after,
    description,
    metadata: { rentalBookingId: bookingId, ...(claimId ? { rentalClaimId: claimId } : {}) },
  }], { session })
}

const creditWallet = async ({ userId, amount, type, bookingId, claimId, description }, session) => {
  if (amount <= 0) return null
  const before = await UserWallet.findOne({ user: userId }).session(session)
  const wallet = await UserWallet.findOneAndUpdate(
    { user: userId },
    { $inc: { balance: amount } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session }
  )
  await walletActivity({ wallet: wallet._id, user: userId, type, amount, before: before?.balance || 0, after: wallet.balance, bookingId, claimId, description }, session)
  return wallet
}

export const payRentalBooking = async (bookingId, user) => {
  const current = await getBooking(bookingId)
  const renterId = current.renter?._id || current.renter
  if (String(renterId) !== String(user._id)) {
    throw new AppError('Chỉ người thuê mới được thanh toán booking', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
  if (current.paidAt && current.status !== RENTAL_BOOKING_STATUS.PAYMENT_PENDING) return current
  if (current.status !== RENTAL_BOOKING_STATUS.PAYMENT_PENDING) {
    throw new AppError('Booking không còn ở trạng thái chờ thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }
  if (new Date() >= new Date(current.startDate)) {
    throw new AppError('Booking đã quá hạn thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.PAYMENT_WINDOW_EXPIRED)
  }

  await runRequiredMongoTransaction(async (session) => {
    const booking = await RentalBooking.findOne({ _id: bookingId, status: RENTAL_BOOKING_STATUS.PAYMENT_PENDING, paidAt: null }).session(session)
    if (!booking) return
    const amount = booking.rentAmount + booking.depositAmount
    if (amount > 0) {
      const before = await UserWallet.findOne({ user: user._id }).session(session)
      const wallet = await UserWallet.findOneAndUpdate(
        { user: user._id, isActive: true, balance: { $gte: amount } },
        { $inc: { balance: -amount, totalSpent: amount } },
        { returnDocument: 'after', session }
      )
      if (!wallet) {
        throw new AppError('Số dư ví không đủ để thanh toán booking thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
      }
      await walletActivity({
        wallet: wallet._id,
        user: user._id,
        type: USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT,
        amount,
        before: before?.balance || 0,
        after: wallet.balance,
        bookingId: booking._id,
        description: `Thanh toán booking thuê #${booking._id}`,
      }, session)
      await postBalancedTransaction({
        commandKey: `rental_hold:${booking._id}`,
        transactionType: 'rental_payment_hold',
        referenceType: 'RentalBooking',
        referenceId: booking._id,
        entries: [
          { account: accountDefinitions.userWallet(user._id), direction: 'debit', amount },
          { account: accountDefinitions.rentalEscrow(booking._id), direction: 'credit', amount },
        ],
      }, session)
    }
    booking.status = RENTAL_BOOKING_STATUS.CONFIRMED
    booking.paidAt = new Date()
    appendTimeline(booking, RENTAL_BOOKING_STATUS.CONFIRMED, user._id, 'Thanh toán booking thành công')
    await booking.save({ session })
  })
  return getBooking(bookingId)
}

const rentalFeePreview = async (booking) => {
  try {
    return await previewFee({
      transactionType: 'RENTAL',
      ownerType: booking.ownerType,
      categoryId: booking.product?.category || null,
      baseAmount: booking.actualRentAmount,
      transactionCreatedAt: new Date(),
    })
  } catch {
    const calculatedFee = Math.round(booking.actualRentAmount * 0.05)
    return {
      feePolicyId: null,
      transactionType: 'RENTAL',
      ownerType: booking.ownerType,
      categoryId: booking.product?.category || null,
      baseAmountType: 'RENTAL_ACTUAL_AMOUNT',
      rounding: 'ROUND',
      percent: 5,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee,
      netAmount: booking.actualRentAmount - calculatedFee,
    }
  }
}

export const confirmRentalReturn = async (bookingId, payload, user) => {
  const current = await getBooking(bookingId)
  if (![RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION, RENTAL_BOOKING_STATUS.DISPUTED].includes(current.status)) {
    throw new AppError('Booking chưa ở trạng thái chờ xác nhận trả', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }
  const ownerId = ownerIdOf(current)
  if (String(ownerId) !== String(user._id)) {
    throw new AppError('Chỉ bên cho thuê mới được xác nhận hoàn trả', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
  current.actualDays = diffDaysInclusive(current.startDate, current.returnedAt || current.endDate)
  current.actualRentAmount = current.actualDays * current.dailyRate
  const preview = await rentalFeePreview(current)

  await runRequiredMongoTransaction(async (session) => {
    const booking = await RentalBooking.findOne({
      _id: bookingId,
      status: { $in: [RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION, RENTAL_BOOKING_STATUS.DISPUTED] },
      feeSnapshotId: null,
    }).session(session)
    if (!booking) return
    const renterId = booking.renter
    booking.actualDays = diffDaysInclusive(booking.startDate, booking.returnedAt || booking.endDate)
    booking.actualRentAmount = booking.actualDays * booking.dailyRate
    booking.lateFeeAmount = Math.max(0, booking.actualDays - booking.plannedDays) * booking.lateFeePerDay
    booking.unusedRentRefundAmount = Math.max(0, booking.rentAmount - booking.actualRentAmount)
    const additionalRent = Math.max(0, booking.actualRentAmount - booking.rentAmount)
    const additionalCharge = additionalRent + booking.lateFeeAmount

    if (additionalCharge > 0) {
      const before = await UserWallet.findOne({ user: renterId }).session(session)
      const wallet = await UserWallet.findOneAndUpdate(
        { user: renterId, isActive: true, balance: { $gte: additionalCharge } },
        { $inc: { balance: -additionalCharge, totalSpent: additionalCharge } },
        { returnDocument: 'after', session }
      )
      if (!wallet) throw new AppError('Số dư ví không đủ để thanh toán chi phí phát sinh', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
      await walletActivity({
        wallet: wallet._id,
        user: renterId,
        type: additionalRent > 0 ? USER_WALLET_TRANSACTION_TYPE.RENTAL_ADDITIONAL_RENT : USER_WALLET_TRANSACTION_TYPE.RENTAL_LATE_FEE,
        amount: additionalCharge,
        before: before?.balance || 0,
        after: wallet.balance,
        bookingId: booking._id,
        description: `Thanh toán chi phí thuê phát sinh #${booking._id}`,
      }, session)
      await postBalancedTransaction({
        commandKey: `rental_additional:${booking._id}`,
        transactionType: 'rental_additional_charge',
        referenceType: 'RentalBooking',
        referenceId: booking._id,
        entries: [
          { account: accountDefinitions.userWallet(renterId), direction: 'debit', amount: additionalCharge },
          { account: accountDefinitions.rentalEscrow(booking._id), direction: 'credit', amount: additionalCharge },
        ],
      }, session)
    }

    booking.platformFeeAmount = preview.calculatedFee || 0
    booking.ownerSettlementAmount = Math.max(0, booking.actualRentAmount - booking.platformFeeAmount + booking.lateFeeAmount)
    const [snapshot] = await FeeSnapshot.create([{
      sourceType: 'rental', sourceId: booking._id, feePolicyId: preview.feePolicyId || null,
      transactionType: preview.transactionType, ownerType: preview.ownerType, categoryId: preview.categoryId || null,
      baseAmountType: preview.baseAmountType, rounding: preview.rounding, baseAmount: booking.actualRentAmount,
      percent: preview.percent, fixedFee: preview.fixedFee || 0, minFee: preview.minFee || 0,
      maxFee: preview.maxFee ?? null, calculatedFee: booking.platformFeeAmount, netAmount: preview.netAmount,
      effectiveFrom: new Date(), effectiveTo: null, lockedAt: new Date(),
    }], { session })
    booking.feeSnapshotId = snapshot._id
    booking.feePolicyId = preview.feePolicyId || null

    const openClaim = await RentalClaim.findOne({ booking: booking._id, isActive: true, status: { $in: OPEN_CLAIM_STATUSES } }).session(session)
    const depositRelease = openClaim ? 0 : booking.depositAmount
    booking.depositReleasedAmount = depositRelease
    const releaseAmount = booking.platformFeeAmount + booking.ownerSettlementAmount + booking.unusedRentRefundAmount + depositRelease
    const entries = [{ account: accountDefinitions.rentalEscrow(booking._id), direction: 'debit', amount: releaseAmount }]
    if (booking.platformFeeAmount > 0) entries.push({ account: accountDefinitions.platformRevenue(), direction: 'credit', amount: booking.platformFeeAmount })
    if (booking.ownerSettlementAmount > 0) {
      await creditWallet({ userId: ownerId, amount: booking.ownerSettlementAmount, type: USER_WALLET_TRANSACTION_TYPE.RENTAL_OWNER_SETTLEMENT, bookingId: booking._id, description: `Nhận quyết toán cho thuê #${booking._id}` }, session)
      entries.push({ account: accountDefinitions.userWallet(ownerId), direction: 'credit', amount: booking.ownerSettlementAmount })
    }
    const renterRefund = booking.unusedRentRefundAmount + depositRelease
    if (renterRefund > 0) {
      await creditWallet({ userId: renterId, amount: renterRefund, type: depositRelease > 0 ? USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE : USER_WALLET_TRANSACTION_TYPE.RENTAL_UNUSED_REFUND, bookingId: booking._id, description: `Hoàn tiền thuê và tiền cọc #${booking._id}` }, session)
      entries.push({ account: accountDefinitions.userWallet(renterId), direction: 'credit', amount: renterRefund })
    }
    if (releaseAmount > 0) {
      await postBalancedTransaction({
        commandKey: `rental_settlement:${booking._id}`,
        transactionType: 'rental_return_settlement',
        referenceType: 'RentalBooking',
        referenceId: booking._id,
        metadata: { depositHeld: openClaim ? booking.depositAmount : 0 },
        entries,
      }, session)
    }
    booking.status = openClaim ? RENTAL_BOOKING_STATUS.DISPUTED : RENTAL_BOOKING_STATUS.COMPLETED
    booking.completedAt = openClaim ? null : new Date()
    appendTimeline(booking, booking.status, user._id, payload.note || (openClaim ? 'Giữ cọc vì claim đang mở' : 'Xác nhận hoàn trả thành công'))
    await booking.save({ session })
  })
  return getBooking(bookingId)
}

export const resolveAdminRentalClaim = async (claimId, payload, adminUser) => {
  const result = await runRequiredMongoTransaction(async (session) => {
    const claim = await RentalClaim.findById(claimId).session(session)
    if (!claim) throw new AppError('Không tìm thấy claim cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.CLAIM_NOT_FOUND)
    if (claim.reviewedAt && !claim.isActive) return claim
    if (!OPEN_CLAIM_STATUSES.includes(claim.status)) {
      throw new AppError('Claim không còn ở trạng thái xử lý', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.DISPUTE_REQUIRED)
    }
    const booking = await RentalBooking.findById(claim.booking).session(session).populate({ path: 'shop', select: 'owner' })
    if (!booking) throw new AppError('Không tìm thấy booking cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.BOOKING_NOT_FOUND)
    const approved = Math.max(0, Math.min(payload.approvedAmount ?? 0, booking.depositAmount))
    const renterRelease = booking.depositAmount - approved
    const ownerId = ownerIdOf(booking)
    if (approved > 0) await creditWallet({ userId: ownerId, amount: approved, type: USER_WALLET_TRANSACTION_TYPE.RENTAL_CLAIM_DEDUCTION, bookingId: booking._id, claimId: claim._id, description: `Nhận khấu trừ cọc từ claim #${claim._id}` }, session)
    if (renterRelease > 0) await creditWallet({ userId: booking.renter, amount: renterRelease, type: USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE, bookingId: booking._id, claimId: claim._id, description: `Hoàn phần cọc còn lại sau claim #${claim._id}` }, session)
    if (booking.depositAmount > 0) {
      const entries = [{ account: accountDefinitions.rentalEscrow(booking._id), direction: 'debit', amount: booking.depositAmount }]
      if (approved > 0) entries.push({ account: accountDefinitions.userWallet(ownerId), direction: 'credit', amount: approved })
      if (renterRelease > 0) entries.push({ account: accountDefinitions.userWallet(booking.renter), direction: 'credit', amount: renterRelease })
      await postBalancedTransaction({
        commandKey: `rental_claim:${claim._id}`,
        transactionType: 'rental_claim_settlement',
        referenceType: 'RentalClaim',
        referenceId: claim._id,
        entries,
      }, session)
    }
    claim.approvedAmount = approved
    claim.resolutionNote = payload.note || ''
    claim.reviewedByAdmin = adminUser._id
    claim.reviewedAt = new Date()
    claim.closedAt = new Date()
    claim.isActive = false
    claim.status = approved <= 0 ? RENTAL_CLAIM_STATUS.REJECTED : approved >= claim.requestedAmount ? RENTAL_CLAIM_STATUS.APPROVED : RENTAL_CLAIM_STATUS.PARTIALLY_APPROVED
    await claim.save({ session })
    booking.claimDeductionAmount = approved
    booking.depositReleasedAmount = renterRelease
    booking.status = RENTAL_BOOKING_STATUS.COMPLETED
    booking.completedAt = new Date()
    appendTimeline(booking, RENTAL_BOOKING_STATUS.COMPLETED, adminUser._id, payload.note || 'Admin đã xử lý claim cho thuê')
    await booking.save({ session })
    return claim
  })
  await writeAuditLog({
    adminId: adminUser._id,
    action: 'rental_claim_resolve',
    targetType: 'rental_claim',
    targetId: result._id,
    newStatus: result.status,
    adminNote: payload.note || '',
    metadata: { approvedAmount: result.approvedAmount },
  })
  return RentalClaim.findById(result._id)
}
