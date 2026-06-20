import FeeSnapshot from '../../models/fee-snapshot.model.js'
import LedgerEntry from '../../models/ledger-entry.model.js'
import LedgerTransaction from '../../models/ledger-transaction.model.js'
import PlatformWallet from '../../models/platform-wallet.model.js'
import RentalBooking from '../../models/rental-booking.model.js'
import RentalClaim from '../../models/rental-claim.model.js'
import RentalInspection from '../../models/rental-inspection.model.js'
import RentalListing from '../../models/rental-listing.model.js'
import AppError from '../../utils/app-error.util.js'
import ERRORS from '../../constants/error.constant.js'
import HTTP_STATUS from '../../constants/http-status.constant.js'
import { buildPaginationMeta } from '../../utils/pagination.util.js'
import { previewFee } from '../fee-policy/fee-policy.service.js'
import { writeAuditLog } from '../audit/audit-log.service.js'
import {
  LEDGER_ENTRY_DIRECTION,
  LEDGER_REFERENCE_TYPE,
  LEDGER_TRANSACTION_TYPE,
  PLATFORM_WALLET_KEYS,
} from '../../constants/ledger.constant.js'
import { RENTAL_BOOKING_STATUS, RENTAL_CLAIM_STATUS, USER_WALLET_TRANSACTION_TYPE } from '../../constants/status.constant.js'
import * as userWalletRepo from '../../repositories/user-wallet/user-wallet.repository.js'
import { assertRentalListingOwnerContext, assertRentalProductEligibility } from './rental-eligibility.service.js'

const ACTIVE_BOOKING_STATUSES = [
  RENTAL_BOOKING_STATUS.PAYMENT_PENDING,
  RENTAL_BOOKING_STATUS.CONFIRMED,
  RENTAL_BOOKING_STATUS.READY_FOR_HANDOVER,
  RENTAL_BOOKING_STATUS.IN_RENTAL,
  RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION,
  RENTAL_BOOKING_STATUS.OVERDUE,
  RENTAL_BOOKING_STATUS.DISPUTED,
]

const RENTAL_LISTING_POPULATE = [
  { path: 'product', populate: [{ path: 'category', select: 'name slug' }, { path: 'seller', select: 'name email avatar kyc' }, { path: 'shop', select: 'name slug owner' }] },
  { path: 'seller', select: 'name email avatar' },
  { path: 'shop', select: 'name slug owner' },
]

const RENTAL_BOOKING_POPULATE = [
  { path: 'listing', populate: RENTAL_LISTING_POPULATE },
  { path: 'product', select: 'title price status images ownerType seller shop category' },
  { path: 'renter', select: 'name email avatar' },
  { path: 'seller', select: 'name email avatar' },
  { path: 'shop', select: 'name slug owner' },
]

const RENTAL_CLAIM_POPULATE = [
  { path: 'booking', populate: RENTAL_BOOKING_POPULATE },
  { path: 'listing', populate: RENTAL_LISTING_POPULATE },
  { path: 'claimant', select: 'name email avatar' },
  { path: 'renter', select: 'name email avatar' },
  { path: 'seller', select: 'name email avatar' },
  { path: 'shop', select: 'name slug' },
  { path: 'reviewedByAdmin', select: 'name email' },
]

const HIGH_VALUE_RENTAL_THRESHOLD = 5000000
const WATCHLIST_CATEGORY_KEYWORDS = ['dien-tu', 'điện tử', 'guong', 'gương', 'gom', 'gốm', 'glass', 'fragile']

const populateChain = (query, populate) => populate.reduce((current, item) => current.populate(item), query)

const matchesWatchlistCategory = (category) => {
  const source = [category?.slug, category?.name].filter(Boolean).join(' ').toLowerCase()
  return WATCHLIST_CATEGORY_KEYWORDS.some((keyword) => source.includes(keyword))
}

const withRentalRiskSummary = async (entity) => {
  const booking = entity.booking || entity
  const renterId = booking?.renter?._id || booking?.renter
  const product =
    entity?.listing?.product && typeof entity.listing.product !== 'string'
      ? entity.listing.product
      : booking?.product && typeof booking.product !== 'string'
        ? booking.product
        : null
  const totalExposure = Number(booking?.rentAmount || 0) + Number(booking?.depositAmount || 0) + Number(booking?.lateFeeAmount || 0)
  const renterDisputeCount = renterId
    ? await RentalBooking.countDocuments({
        renter: renterId,
        status: RENTAL_BOOKING_STATUS.DISPUTED,
        _id: { $ne: booking?._id || null },
      })
    : 0

  const flags = []
  if (totalExposure >= HIGH_VALUE_RENTAL_THRESHOLD) flags.push('high_value')
  if (renterDisputeCount > 0) flags.push('renter_watchlist')
  if (product && matchesWatchlistCategory(product.category)) flags.push('category_watchlist')

  return {
    ...(typeof entity.toObject === 'function' ? entity.toObject() : entity),
    riskSummary: {
      level: flags.includes('high_value') || flags.includes('renter_watchlist') ? 'high' : flags.length ? 'medium' : 'low',
      flags,
      totalExposure,
      renterDisputeCount,
      isHighValue: flags.includes('high_value'),
    },
  }
}

const appendTimeline = (booking, status, userId, note = '') => {
  booking.timeline = [
    ...(booking.timeline || []),
    {
      status,
      note,
      updatedBy: userId,
      updatedAt: new Date(),
    },
  ]
}

const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const endOfDay = (value) => {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

const diffDaysInclusive = (start, end) => {
  const startDate = startOfDay(start)
  const endDate = startOfDay(end)
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
}

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

const buildRentalFeePreview = async (booking, categoryId) => {
  try {
    return await previewFee({
      transactionType: 'RENTAL',
      ownerType: booking.ownerType,
      categoryId: categoryId || null,
      baseAmount: booking.actualRentAmount,
      transactionCreatedAt: new Date(),
    })
  } catch {
    const calculatedFee = Math.round(Number(booking.actualRentAmount || 0) * 0.05)
    return {
      feePolicyId: null,
      transactionType: 'RENTAL',
      ownerType: booking.ownerType,
      categoryId: categoryId || null,
      baseAmountType: 'RENTAL_ACTUAL_AMOUNT',
      rounding: 'ROUND',
      percent: 5,
      fixedFee: 0,
      minFee: 0,
      maxFee: null,
      calculatedFee,
      baseAmount: booking.actualRentAmount,
      netAmount: Math.max(0, booking.actualRentAmount - calculatedFee),
    }
  }
}

const assertListingForBooking = async (listingId) => {
  const listing = await populateChain(RentalListing.findById(listingId), RENTAL_LISTING_POPULATE)

  if (!listing || !listing.isActive) {
    throw new AppError('Không tìm thấy tin cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.LISTING_NOT_FOUND)
  }

  if (!listing.product || ['sold', 'hidden', 'pending', 'disputed'].includes(listing.product.status)) {
    throw new AppError('Sản phẩm hiện không thể đặt thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.PRODUCT_NOT_ELIGIBLE)
  }

  return listing
}

const assertBookingParticipantAccess = (booking, userId) => {
  const isRenter = String(booking.renter?._id || booking.renter) === String(userId)
  const isSeller = booking.seller && String(booking.seller?._id || booking.seller) === String(userId)
  if (!isRenter && !isSeller) {
    throw new AppError('Bạn không thuộc booking cho thuê này', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }
}

const isBookingOwnerActor = (booking, userId) => {
  if (booking.ownerType === 'SHOP') {
    return String(booking.shop?.owner?._id || booking.shop?.owner || '') === String(userId)
  }

  return String(booking.seller?._id || booking.seller || '') === String(userId)
}

const getBookingByIdOrThrow = async (bookingId) => {
  const booking = await populateChain(RentalBooking.findById(bookingId), RENTAL_BOOKING_POPULATE)
  if (!booking || !booking.isActive) {
    throw new AppError('Không tìm thấy booking cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.BOOKING_NOT_FOUND)
  }
  return booking
}

const getClaimByIdOrThrow = async (claimId) => {
  const claim = await populateChain(RentalClaim.findById(claimId), RENTAL_CLAIM_POPULATE)
  if (!claim || !claim.isActive) {
    throw new AppError('Không tìm thấy claim cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.CLAIM_NOT_FOUND)
  }
  return claim
}

const getClaimByIdIncludingInactiveOrThrow = async (claimId) => {
  const claim = await populateChain(RentalClaim.findById(claimId), RENTAL_CLAIM_POPULATE)
  if (!claim) {
    throw new AppError('Không tìm thấy claim cho thuê', HTTP_STATUS.NOT_FOUND, ERRORS.RENTAL.CLAIM_NOT_FOUND)
  }
  return claim
}

export const createRentalListing = async (payload, user) => {
  const product = await assertRentalProductEligibility(payload.productId)
  const ownerContext = await assertRentalListingOwnerContext(product, payload, user._id)

  const existingListing = await RentalListing.findOne({ product: product._id, isActive: true })
  if (existingListing) {
    existingListing.dailyRate = payload.dailyRate
    existingListing.depositAmount = payload.depositAmount ?? existingListing.depositAmount
    existingListing.lateFeePerDay = payload.lateFeePerDay ?? existingListing.lateFeePerDay
    existingListing.minRentalDays = payload.minRentalDays ?? existingListing.minRentalDays
    existingListing.maxRentalDays = payload.maxRentalDays ?? existingListing.maxRentalDays
    existingListing.title = payload.title || product.title
    existingListing.description = payload.description || product.description
    await existingListing.save()
    return populateChain(RentalListing.findById(existingListing._id), RENTAL_LISTING_POPULATE)
  }

  const listing = await RentalListing.create({
    product: product._id,
    ownerType: ownerContext.ownerType,
    seller: ownerContext.seller,
    shop: ownerContext.shop,
    title: payload.title || product.title,
    description: payload.description || product.description,
    dailyRate: payload.dailyRate,
    depositAmount: payload.depositAmount ?? 0,
    lateFeePerDay: payload.lateFeePerDay ?? payload.dailyRate,
    minRentalDays: payload.minRentalDays ?? 1,
    maxRentalDays: payload.maxRentalDays ?? 30,
  })

  return populateChain(RentalListing.findById(listing._id), RENTAL_LISTING_POPULATE)
}

export const listRentalListings = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = {}

  if (query.productId) filter.product = query.productId
  if (query.ownerType) filter.ownerType = query.ownerType
  if (query.sellerId) filter.seller = query.sellerId
  if (query.shopId) filter.shop = query.shopId
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'false' ? false : Boolean(query.isActive)
  else filter.isActive = true

  const [listings, total] = await Promise.all([
    populateChain(RentalListing.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit), RENTAL_LISTING_POPULATE),
    RentalListing.countDocuments(filter),
  ])

  return {
    rentalListings: listings,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getRentalListingById = async (listingId) => assertListingForBooking(listingId)

export const createRentalBooking = async (payload, user) => {
  const listing = await assertListingForBooking(payload.listingId)

  const productOwnerId =
    listing.ownerType === 'SELLER'
      ? String(listing.seller?._id || listing.seller)
      : String(listing.product?.shop?.owner?._id || listing.product?.shop?.owner || '')

  if (productOwnerId === String(user._id)) {
    throw new AppError('Bạn không thể thuê sản phẩm của chính mình', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.SELF_RENTAL_NOT_ALLOWED)
  }

  const startDate = startOfDay(payload.startDate)
  const endDate = endOfDay(payload.endDate)
  const plannedDays = diffDaysInclusive(startDate, endDate)

  if (plannedDays < 1 || plannedDays > 30 || plannedDays < listing.minRentalDays || plannedDays > listing.maxRentalDays) {
    throw new AppError('Thời gian thuê phải từ 1 đến 30 ngày', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT)
  }

  const overlap = await RentalBooking.exists({
    listing: listing._id,
    isActive: true,
    status: { $in: ACTIVE_BOOKING_STATUSES },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  })

  if (overlap) {
    throw new AppError('Đã có booking trùng lịch cho khoảng thời gian này', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.OVERLAPPING_BOOKING)
  }

  const booking = await RentalBooking.create({
    listing: listing._id,
    product: listing.product._id,
    ownerType: listing.ownerType,
    seller: listing.seller?._id || listing.seller || null,
    shop: listing.shop?._id || listing.shop || null,
    renter: user._id,
    startDate,
    endDate,
    plannedDays,
    dailyRate: listing.dailyRate,
    depositAmount: listing.depositAmount,
    lateFeePerDay: listing.lateFeePerDay,
    rentAmount: listing.dailyRate * plannedDays,
    depositHeldAmount: listing.depositAmount,
    status: RENTAL_BOOKING_STATUS.PAYMENT_PENDING,
    note: payload.note || '',
    timeline: [
      {
        status: RENTAL_BOOKING_STATUS.PAYMENT_PENDING,
        note: payload.note || 'Tạo booking chờ thanh toán',
        updatedBy: user._id,
      },
    ],
  })

  return populateChain(RentalBooking.findById(booking._id), RENTAL_BOOKING_POPULATE)
}

export const listRentalBookings = async (user, query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }

  if (query.scope === 'mine') {
    filter.renter = user._id
  } else if (query.ownerType === 'SHOP' && query.shopId) {
    filter.ownerType = 'SHOP'
    filter.shop = query.shopId
  } else {
    filter.ownerType = 'SELLER'
    filter.seller = user._id
  }

  if (query.status) {
    filter.status = query.status
  }

  const [bookings, total] = await Promise.all([
    populateChain(RentalBooking.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit), RENTAL_BOOKING_POPULATE),
    RentalBooking.countDocuments(filter),
  ])

  return {
    rentalBookings: await Promise.all(bookings.map((booking) => withRentalRiskSummary(booking))),
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getRentalBookingById = async (bookingId, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)

  if (!isBookingOwnerActor(booking, user._id)) {
    assertBookingParticipantAccess(booking, user._id)
  }

  return booking
}

export const payRentalBooking = async (bookingId, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)

  if (
    booking.paidAt &&
    [
      RENTAL_BOOKING_STATUS.CONFIRMED,
      RENTAL_BOOKING_STATUS.READY_FOR_HANDOVER,
      RENTAL_BOOKING_STATUS.IN_RENTAL,
      RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION,
      RENTAL_BOOKING_STATUS.OVERDUE,
      RENTAL_BOOKING_STATUS.COMPLETED,
      RENTAL_BOOKING_STATUS.DISPUTED,
    ].includes(booking.status)
  ) {
    return booking
  }

  if (String(booking.renter?._id || booking.renter) !== String(user._id)) {
    throw new AppError('Chỉ người thuê mới được thanh toán booking', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (booking.status !== RENTAL_BOOKING_STATUS.PAYMENT_PENDING) {
    throw new AppError('Booking không còn ở trạng thái chờ thanh toán', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }

  const totalHoldAmount = booking.rentAmount + booking.depositAmount
  const walletBefore = await userWalletRepo.findByUser(user._id)
  const balanceBefore = walletBefore?.balance || 0
  const renterWallet = await userWalletRepo.deductForExchange(user._id, totalHoldAmount)

  if (!renterWallet) {
    throw new AppError('Số dư ví không đủ để thanh toán booking thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
  }

  const walletTx = await userWalletRepo.createTransaction({
    wallet: renterWallet._id,
    user: user._id,
    type: USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT,
    amount: totalHoldAmount,
    balanceBefore,
    balanceAfter: renterWallet.balance,
    description: `Thanh toán booking thuê #${booking._id}`,
    metadata: { rentalBookingId: booking._id },
  })

  const ledgerDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.RENTAL_PAYMENT_HOLD,
      referenceType: LEDGER_REFERENCE_TYPE.RENTAL_BOOKING,
      referenceId: booking._id,
      grossAmount: totalHoldAmount,
      platformFee: 0,
      netSettlementAmount: booking.rentAmount,
      settlementStatus: 'held',
      source: 'rental_wallet_payment',
      description: `Hold rental payment for booking ${booking._id}`,
      metadata: {
        renterUserId: user._id,
        walletTransactionId: walletTx._id,
      },
    },
  ])

  const holdTx = ledgerDocs[0]
  const clearingWallet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, totalHoldAmount)

  await LedgerEntry.create({
    ledgerTransaction: holdTx._id,
    walletKey: PLATFORM_WALLET_KEYS.CLEARING,
    direction: LEDGER_ENTRY_DIRECTION.CREDIT,
    amount: totalHoldAmount,
    balanceAfter: clearingWallet.balance,
    counterpartyType: 'rental_renter_wallet',
    counterpartyId: user._id,
    note: 'Hold rental amount and deposit in platform clearing wallet',
    metadata: { rentalBookingId: booking._id },
  })

  booking.status = RENTAL_BOOKING_STATUS.CONFIRMED
  booking.paidAt = new Date()
  appendTimeline(booking, RENTAL_BOOKING_STATUS.CONFIRMED, user._id, 'Thanh toán booking thành công')
  await booking.save()

  return getBookingByIdOrThrow(booking._id)
}

export const handoverRentalBooking = async (bookingId, payload, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)

  if (booking.status !== RENTAL_BOOKING_STATUS.CONFIRMED) {
    throw new AppError('Booking chưa sẵn sàng bàn giao', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }

  const ownerId =
    booking.ownerType === 'SHOP'
      ? booking.shop?.owner?._id || booking.shop?.owner
      : booking.seller?._id || booking.seller
  if (String(ownerId) !== String(user._id)) {
    throw new AppError('Chỉ bên cho thuê mới được xác nhận bàn giao', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  booking.status = RENTAL_BOOKING_STATUS.IN_RENTAL
  booking.handedOverAt = new Date()
  appendTimeline(booking, RENTAL_BOOKING_STATUS.IN_RENTAL, user._id, payload.note || 'Đã bàn giao sản phẩm')
  await booking.save()

  await RentalInspection.create({
    booking: booking._id,
    inspectionType: 'handover',
    conditionNote: payload.note || '',
    images: payload.images || [],
    createdBy: user._id,
  })

  return getBookingByIdOrThrow(booking._id)
}

export const returnRentalBooking = async (bookingId, payload, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)

  if (String(booking.renter?._id || booking.renter) !== String(user._id)) {
    throw new AppError('Chỉ người thuê mới được trả sản phẩm', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  if (booking.status !== RENTAL_BOOKING_STATUS.IN_RENTAL) {
    throw new AppError('Booking chưa ở trạng thái đang thuê', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }

  booking.status = RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION
  booking.returnedAt = new Date(payload.returnedAt || Date.now())
  appendTimeline(booking, RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION, user._id, payload.note || 'Người thuê đã trả sản phẩm')
  await booking.save()

  await RentalInspection.create({
    booking: booking._id,
    inspectionType: 'return',
    conditionNote: payload.note || '',
    images: payload.images || [],
    createdBy: user._id,
  })

  return getBookingByIdOrThrow(booking._id)
}

export const confirmRentalReturn = async (bookingId, payload, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)

  if (
    booking.status !== RENTAL_BOOKING_STATUS.RETURN_PENDING_CONFIRMATION &&
    booking.status !== RENTAL_BOOKING_STATUS.DISPUTED
  ) {
    throw new AppError('Booking chưa ở trạng thái chờ xác nhận trả', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.INVALID_STATUS_TRANSITION)
  }

  const ownerId =
    booking.ownerType === 'SHOP'
      ? booking.shop?.owner?._id || booking.shop?.owner
      : booking.seller?._id || booking.seller
  if (String(ownerId) !== String(user._id)) {
    throw new AppError('Chỉ bên cho thuê mới được xác nhận hoàn trả', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN)
  }

  booking.actualDays = diffDaysInclusive(booking.startDate, booking.returnedAt || booking.endDate)
  booking.actualRentAmount = booking.actualDays * booking.dailyRate
  booking.lateFeeAmount = Math.max(0, booking.actualDays - booking.plannedDays) * booking.lateFeePerDay
  booking.unusedRentRefundAmount = Math.max(0, booking.rentAmount - booking.actualRentAmount)
  const additionalRentAmount = Math.max(0, booking.actualRentAmount - booking.rentAmount)

  if (additionalRentAmount > 0) {
    const walletBefore = await userWalletRepo.findByUser(booking.renter._id || booking.renter)
    const balanceBefore = walletBefore?.balance || 0
    const renterWallet = await userWalletRepo.deductForExchange(booking.renter._id || booking.renter, additionalRentAmount)
    if (!renterWallet) {
      throw new AppError('Số dư ví không đủ để thanh toán phần tiền thuê phát sinh', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
    }

    await userWalletRepo.createTransaction({
      wallet: renterWallet._id,
      user: booking.renter._id || booking.renter,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_ADDITIONAL_RENT,
      amount: additionalRentAmount,
      balanceBefore,
      balanceAfter: renterWallet.balance,
      description: `Thanh toán phần tiền thuê phát sinh cho booking #${booking._id}`,
      metadata: { rentalBookingId: booking._id },
    })

    await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, additionalRentAmount)
  }

  if (booking.lateFeeAmount > 0) {
    const walletBefore = await userWalletRepo.findByUser(booking.renter._id || booking.renter)
    const balanceBefore = walletBefore?.balance || 0
    const renterWallet = await userWalletRepo.deductForExchange(booking.renter._id || booking.renter, booking.lateFeeAmount)
    if (!renterWallet) {
      throw new AppError('Số dư ví không đủ để thanh toán phí trả trễ', HTTP_STATUS.BAD_REQUEST, ERRORS.USER_WALLET.INSUFFICIENT_BALANCE)
    }

    await userWalletRepo.createTransaction({
      wallet: renterWallet._id,
      user: booking.renter._id || booking.renter,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_LATE_FEE,
      amount: booking.lateFeeAmount,
      balanceBefore,
      balanceAfter: renterWallet.balance,
      description: `Thanh toán phí trả trễ cho booking thuê #${booking._id}`,
      metadata: { rentalBookingId: booking._id },
    })

    await mutatePlatformWallet(PLATFORM_WALLET_KEYS.CLEARING, LEDGER_ENTRY_DIRECTION.CREDIT, booking.lateFeeAmount)
  }

  const feePreview = await buildRentalFeePreview(booking, booking.product.category)
  booking.platformFeeAmount = feePreview.calculatedFee || 0
  booking.ownerSettlementAmount = Math.max(0, booking.actualRentAmount - booking.platformFeeAmount + booking.lateFeeAmount)

  const feeSnapshot = await FeeSnapshot.create({
    sourceType: 'rental',
    sourceId: booking._id,
    feePolicyId: feePreview.feePolicyId || null,
    transactionType: feePreview.transactionType,
    ownerType: feePreview.ownerType,
    categoryId: feePreview.categoryId || null,
    baseAmountType: feePreview.baseAmountType,
    rounding: feePreview.rounding,
    baseAmount: booking.actualRentAmount,
    percent: feePreview.percent,
    fixedFee: feePreview.fixedFee || 0,
    minFee: feePreview.minFee || 0,
    maxFee: feePreview.maxFee ?? null,
    calculatedFee: booking.platformFeeAmount,
    netAmount: feePreview.netAmount,
    effectiveFrom: new Date(),
    effectiveTo: null,
    lockedAt: new Date(),
  })

  booking.feeSnapshotId = feeSnapshot._id
  booking.feePolicyId = feePreview.feePolicyId || null

  const openClaim = await RentalClaim.findOne({ booking: booking._id, isActive: true, status: { $in: [RENTAL_CLAIM_STATUS.OPEN, RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW, RENTAL_CLAIM_STATUS.WAITING_RENTER_RESPONSE] } })
  const depositReleaseAmount = openClaim ? 0 : booking.depositAmount
  booking.depositReleasedAmount = depositReleaseAmount

  const releaseDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.RENTAL_RETURN_SETTLEMENT,
      referenceType: LEDGER_REFERENCE_TYPE.RENTAL_BOOKING,
      referenceId: booking._id,
      grossAmount: booking.rentAmount + booking.depositAmount + booking.lateFeeAmount,
      platformFee: booking.platformFeeAmount,
      netSettlementAmount: booking.ownerSettlementAmount,
      settlementStatus: openClaim ? 'disputed' : 'settled',
      source: 'rental_return_confirmation',
      description: `Settle rental return for booking ${booking._id}`,
      metadata: {
        unusedRentRefundAmount: booking.unusedRentRefundAmount,
        depositReleaseAmount,
      },
    },
  ])

  const releaseTx = releaseDocs[0]

  const createdEntries = []

  if (booking.platformFeeAmount > 0) {
    const revenueWallet = await mutatePlatformWallet(PLATFORM_WALLET_KEYS.REVENUE, LEDGER_ENTRY_DIRECTION.CREDIT, booking.platformFeeAmount)
    createdEntries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.REVENUE,
      direction: LEDGER_ENTRY_DIRECTION.CREDIT,
      amount: booking.platformFeeAmount,
      balanceAfter: revenueWallet.balance,
      counterpartyType: 'rental_platform_fee',
      counterpartyId: booking._id,
      note: 'Recognize platform fee from actual rental amount',
      metadata: { rentalBookingId: booking._id },
    })
    createdEntries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: booking.platformFeeAmount,
      balanceAfter: 0,
      counterpartyType: 'rental_platform_fee_transfer',
      counterpartyId: booking._id,
      note: 'Move rental platform fee out of clearing wallet',
      metadata: { rentalBookingId: booking._id },
    })
  }

  if (booking.ownerSettlementAmount > 0) {
    const walletBefore = await userWalletRepo.findByUser(ownerId)
    const balanceBefore = walletBefore?.balance || 0
    const ownerWallet = await userWalletRepo.creditExchangeSettlement(ownerId, booking.ownerSettlementAmount)
    await userWalletRepo.createTransaction({
      wallet: ownerWallet._id,
      user: ownerId,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_OWNER_SETTLEMENT,
      amount: booking.ownerSettlementAmount,
      balanceBefore,
      balanceAfter: ownerWallet.balance,
      description: `Nhận quyết toán cho thuê #${booking._id}`,
      metadata: { rentalBookingId: booking._id },
    })
    createdEntries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: booking.ownerSettlementAmount,
      balanceAfter: 0,
      counterpartyType: 'rental_owner_wallet',
      counterpartyId: ownerId,
      note: 'Release rental settlement to owner wallet',
      metadata: { rentalBookingId: booking._id },
    })
  }

  if (booking.unusedRentRefundAmount > 0) {
    const renterId = booking.renter._id || booking.renter
    const walletBefore = await userWalletRepo.findByUser(renterId)
    const balanceBefore = walletBefore?.balance || 0
    const renterWallet = await userWalletRepo.refundFromExchange(renterId, booking.unusedRentRefundAmount)
    await userWalletRepo.createTransaction({
      wallet: renterWallet._id,
      user: renterId,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_UNUSED_REFUND,
      amount: booking.unusedRentRefundAmount,
      balanceBefore,
      balanceAfter: renterWallet.balance,
      description: `Hoàn tiền thuê chưa dùng cho booking #${booking._id}`,
      metadata: { rentalBookingId: booking._id },
    })
    createdEntries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: booking.unusedRentRefundAmount,
      balanceAfter: 0,
      counterpartyType: 'rental_renter_wallet',
      counterpartyId: renterId,
      note: 'Refund unused rental amount to renter wallet',
      metadata: { rentalBookingId: booking._id },
    })
  }

  if (depositReleaseAmount > 0) {
    const renterId = booking.renter._id || booking.renter
    const walletBefore = await userWalletRepo.findByUser(renterId)
    const balanceBefore = walletBefore?.balance || 0
    const renterWallet = await userWalletRepo.refundFromExchange(renterId, depositReleaseAmount)
    await userWalletRepo.createTransaction({
      wallet: renterWallet._id,
      user: renterId,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE,
      amount: depositReleaseAmount,
      balanceBefore,
      balanceAfter: renterWallet.balance,
      description: `Hoàn cọc cho booking thuê #${booking._id}`,
      metadata: { rentalBookingId: booking._id },
    })
    createdEntries.push({
      ledgerTransaction: releaseTx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: depositReleaseAmount,
      balanceAfter: 0,
      counterpartyType: 'rental_deposit_release',
      counterpartyId: renterId,
      note: openClaim ? 'Deposit remains held because claim is open' : 'Release rental deposit back to renter wallet',
      metadata: { rentalBookingId: booking._id },
    })
  }

  if (createdEntries.length) {
    const clearingWallet = await PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean()
    let runningClearingBalance = clearingWallet?.balance || 0
    for (const entry of createdEntries) {
      if (entry.walletKey === PLATFORM_WALLET_KEYS.CLEARING) {
        if (entry.direction === LEDGER_ENTRY_DIRECTION.DEBIT) {
          runningClearingBalance -= entry.amount
        } else {
          runningClearingBalance += entry.amount
        }
        entry.balanceAfter = runningClearingBalance
      }
    }
    await LedgerEntry.insertMany(createdEntries)
    await PlatformWallet.findOneAndUpdate({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }, { balance: runningClearingBalance })
  }

  booking.status = openClaim ? RENTAL_BOOKING_STATUS.DISPUTED : RENTAL_BOOKING_STATUS.COMPLETED
  booking.completedAt = openClaim ? null : new Date()
  appendTimeline(booking, booking.status, user._id, payload.note || (openClaim ? 'Giữ cọc vì claim đang mở' : 'Xác nhận hoàn trả thành công'))
  await booking.save()

  return getBookingByIdOrThrow(booking._id)
}

export const createRentalClaim = async (bookingId, payload, user) => {
  const booking = await getBookingByIdOrThrow(bookingId)
  assertBookingParticipantAccess(booking, user._id)

  const existingClaim = await RentalClaim.findOne({
    booking: booking._id,
    isActive: true,
    status: { $in: [RENTAL_CLAIM_STATUS.OPEN, RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW, RENTAL_CLAIM_STATUS.WAITING_RENTER_RESPONSE] },
  })

  if (existingClaim) {
    return getClaimByIdOrThrow(existingClaim._id)
  }

  const claim = await RentalClaim.create({
    booking: booking._id,
    listing: booking.listing._id || booking.listing,
    claimant: user._id,
    renter: booking.renter._id || booking.renter,
    ownerType: booking.ownerType,
    seller: booking.seller?._id || booking.seller || null,
    shop: booking.shop?._id || booking.shop || null,
    reason: payload.reason,
    requestedAmount: Math.min(payload.requestedAmount, booking.depositAmount),
    status: RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW,
  })

  booking.status = RENTAL_BOOKING_STATUS.DISPUTED
  booking.disputedAt = new Date()
  appendTimeline(booking, RENTAL_BOOKING_STATUS.DISPUTED, user._id, payload.reason)
  await booking.save()

  return getAdminRentalClaimById(claim._id)
}

export const listAdminRentalBookings = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }
  if (query.status) filter.status = query.status
  if (query.ownerType) filter.ownerType = query.ownerType

  const [bookings, total] = await Promise.all([
    populateChain(RentalBooking.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit), RENTAL_BOOKING_POPULATE),
    RentalBooking.countDocuments(filter),
  ])

  return {
    rentalBookings: bookings,
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const listAdminRentalClaims = async (query, { page, limit, skip, sortBy, sortOrder }) => {
  const filter = { isActive: true }
  if (query.status) filter.status = query.status

  const [claims, total] = await Promise.all([
    populateChain(RentalClaim.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit), RENTAL_CLAIM_POPULATE),
    RentalClaim.countDocuments(filter),
  ])

  return {
    rentalClaims: await Promise.all(claims.map((claim) => withRentalRiskSummary(claim))),
    meta: buildPaginationMeta(total, page, limit),
  }
}

export const getAdminRentalClaimById = async (claimId) => withRentalRiskSummary(await getClaimByIdIncludingInactiveOrThrow(claimId))

export const resolveAdminRentalClaim = async (claimId, payload, adminUser) => {
  const claim = await getClaimByIdIncludingInactiveOrThrow(claimId)

  if (claim.reviewedAt && !claim.isActive) {
    return getAdminRentalClaimById(claimId)
  }

  if (![RENTAL_CLAIM_STATUS.OPEN, RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW, RENTAL_CLAIM_STATUS.WAITING_RENTER_RESPONSE].includes(claim.status)) {
    throw new AppError('Claim không còn ở trạng thái xử lý', HTTP_STATUS.BAD_REQUEST, ERRORS.RENTAL.DISPUTE_REQUIRED)
  }

  const booking = await getBookingByIdOrThrow(claim.booking._id || claim.booking)
  const approvedAmount = Math.max(0, Math.min(payload.approvedAmount ?? 0, booking.depositAmount))

  claim.approvedAmount = approvedAmount
  claim.resolutionNote = payload.note || ''
  claim.reviewedByAdmin = adminUser._id
  claim.reviewedAt = new Date()

  if (approvedAmount <= 0) {
    claim.status = RENTAL_CLAIM_STATUS.REJECTED
  } else if (approvedAmount >= claim.requestedAmount) {
    claim.status = RENTAL_CLAIM_STATUS.APPROVED
  } else {
    claim.status = RENTAL_CLAIM_STATUS.PARTIALLY_APPROVED
  }

  claim.closedAt = new Date()
  claim.isActive = false
  await claim.save()

  const renterId = booking.renter._id || booking.renter
  const ownerId =
    booking.ownerType === 'SHOP'
      ? booking.shop?.owner?._id || booking.shop?.owner
      : booking.seller?._id || booking.seller
  const releaseToRenter = Math.max(0, booking.depositAmount - approvedAmount)

  const releaseDocs = await LedgerTransaction.create([
    {
      transactionType: LEDGER_TRANSACTION_TYPE.RENTAL_CLAIM_SETTLEMENT,
      referenceType: LEDGER_REFERENCE_TYPE.RENTAL_CLAIM,
      referenceId: claim._id,
      grossAmount: booking.depositAmount,
      platformFee: 0,
      netSettlementAmount: approvedAmount,
      settlementStatus: 'settled',
      source: 'admin_rental_claim_resolution',
      description: `Resolve rental claim ${claim._id}`,
      metadata: {
        rentalBookingId: booking._id,
        releaseToRenter,
      },
    },
  ])

  const tx = releaseDocs[0]
  const entries = []

  if (approvedAmount > 0) {
    const walletBefore = await userWalletRepo.findByUser(ownerId)
    const balanceBefore = walletBefore?.balance || 0
    const ownerWallet = await userWalletRepo.creditExchangeSettlement(ownerId, approvedAmount)
    await userWalletRepo.createTransaction({
      wallet: ownerWallet._id,
      user: ownerId,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_CLAIM_DEDUCTION,
      amount: approvedAmount,
      balanceBefore,
      balanceAfter: ownerWallet.balance,
      description: `Nhận khấu trừ cọc từ claim thuê #${claim._id}`,
      metadata: { rentalBookingId: booking._id, rentalClaimId: claim._id },
    })
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: approvedAmount,
      balanceAfter: 0,
      counterpartyType: 'rental_claim_owner_wallet',
      counterpartyId: ownerId,
      note: 'Release approved claim amount to owner wallet',
      metadata: { rentalBookingId: booking._id, rentalClaimId: claim._id },
    })
  }

  if (releaseToRenter > 0) {
    const walletBefore = await userWalletRepo.findByUser(renterId)
    const balanceBefore = walletBefore?.balance || 0
    const renterWallet = await userWalletRepo.refundFromExchange(renterId, releaseToRenter)
    await userWalletRepo.createTransaction({
      wallet: renterWallet._id,
      user: renterId,
      type: USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE,
      amount: releaseToRenter,
      balanceBefore,
      balanceAfter: renterWallet.balance,
      description: `Hoàn phần cọc còn lại sau claim thuê #${claim._id}`,
      metadata: { rentalBookingId: booking._id, rentalClaimId: claim._id },
    })
    entries.push({
      ledgerTransaction: tx._id,
      walletKey: PLATFORM_WALLET_KEYS.CLEARING,
      direction: LEDGER_ENTRY_DIRECTION.DEBIT,
      amount: releaseToRenter,
      balanceAfter: 0,
      counterpartyType: 'rental_claim_renter_wallet',
      counterpartyId: renterId,
      note: 'Release remaining deposit to renter wallet',
      metadata: { rentalBookingId: booking._id, rentalClaimId: claim._id },
    })
  }

  if (entries.length) {
    const clearingWallet = await PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean()
    let runningBalance = clearingWallet?.balance || 0
    for (const entry of entries) {
      runningBalance -= entry.amount
      entry.balanceAfter = runningBalance
    }
    await LedgerEntry.insertMany(entries)
    await PlatformWallet.findOneAndUpdate({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }, { balance: runningBalance })
  }

  booking.claimDeductionAmount = approvedAmount
  booking.depositReleasedAmount = releaseToRenter
  booking.status = RENTAL_BOOKING_STATUS.COMPLETED
  booking.completedAt = new Date()
  appendTimeline(booking, RENTAL_BOOKING_STATUS.COMPLETED, adminUser._id, payload.note || 'Admin đã xử lý claim cho thuê')
  await booking.save()

  await writeAuditLog({
    adminId: adminUser._id,
    action: 'rental_claim_resolve',
    targetType: 'rental_claim',
    targetId: claim._id,
    previousStatus: String(RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW),
    newStatus: claim.status,
    adminNote: payload.note || '',
    metadata: {
      rentalBookingId: booking._id,
      approvedAmount,
      releaseToRenter,
    },
  })

  return getClaimByIdIncludingInactiveOrThrow(claim._id)
}
