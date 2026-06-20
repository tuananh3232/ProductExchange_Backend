/* eslint-env jest */

import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginAdmin, loginMember, loginSeller, loginShopOwner } from '../setup/auth.js'
import { createSampleCategory, createSampleShop } from '../setup/factories.js'
import Product, { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletTransaction from '../../src/models/user-wallet-transaction.model.js'
import RentalBooking from '../../src/models/rental-booking.model.js'
import RentalClaim from '../../src/models/rental-claim.model.js'
import PlatformWallet from '../../src/models/platform-wallet.model.js'
import LedgerTransaction from '../../src/models/ledger-transaction.model.js'
import FeePolicy from '../../src/models/fee-policy.model.js'
import {
  FEE_POLICY_STATUS,
  PRODUCT_STATUS,
  RENTAL_BOOKING_STATUS,
  RENTAL_CLAIM_STATUS,
  USER_WALLET_TRANSACTION_TYPE,
} from '../../src/constants/status.constant.js'
import {
  LEDGER_REFERENCE_TYPE,
  LEDGER_TRANSACTION_TYPE,
  PLATFORM_WALLET_KEYS,
} from '../../src/constants/ledger.constant.js'

const api = env.apiPrefix

beforeEach(async () => {
  await resetTestDatabase()
})

const createApprovedSeller = (overrides = {}) =>
  loginSeller({
    kyc: {
      fullName: overrides.name || 'Approved Seller',
      idNumber: `KYC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'approved',
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewHistory: [],
    },
    ...overrides,
  })

const createSellerProduct = async (sellerId, { categoryId, price, title } = {}) =>
  Product.create({
    title: title || `Rental Product ${Math.random().toString(36).slice(2, 7)}`,
    description: 'Integration fixture for rental flow.',
    price: price ?? 100000,
    stock: 1,
    listingType: 'sell',
    condition: 'good',
    category: categoryId,
    owner: sellerId,
    ownerType: PRODUCT_OWNER_TYPES.SELLER,
    seller: sellerId,
    shop: null,
    status: PRODUCT_STATUS.AVAILABLE,
    images: [{ url: 'https://example.com/rental-test.png', publicId: 'rental-test' }],
    location: { province: 'Test Province', district: 'Test District' },
  })

const createShopOwnedProduct = async (shop, { categoryId, price, title } = {}) =>
  Product.create({
    title: title || `Shop Rental Product ${Math.random().toString(36).slice(2, 7)}`,
    description: 'Integration fixture for shop rental flow.',
    price: price ?? 100000,
    stock: 1,
    listingType: 'sell',
    condition: 'good',
    category: categoryId,
    owner: shop.owner,
    ownerType: PRODUCT_OWNER_TYPES.SHOP,
    seller: null,
    shop: shop._id,
    status: PRODUCT_STATUS.AVAILABLE,
    images: [{ url: 'https://example.com/rental-shop-test.png', publicId: 'rental-shop-test' }],
    location: { province: 'Test Province', district: 'Test District' },
  })

const seedRentalFeePolicy = ({ adminId, categoryId, ownerType = 'ALL', fixedFee = 20000 }) =>
  FeePolicy.create({
    transactionType: 'RENTAL',
    ownerType,
    categoryId,
    minAmount: 0,
    maxAmount: null,
    percent: 0,
    minFee: 0,
    maxFee: null,
    fixedFee,
    baseAmountType: 'RENTAL_ACTUAL_AMOUNT',
    rounding: 'ROUND',
    status: FEE_POLICY_STATUS.ACTIVE,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdByAdminId: adminId,
    updatedByAdminId: adminId,
  })

const createRentalListing = async ({ ownerToken, productId, ownerType = 'SELLER', shopId, dailyRate, depositAmount, lateFeePerDay }) => {
  const response = await request(app)
    .post(`${api}/rentals/listings`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      productId,
      ownerType,
      shopId,
      dailyRate,
      depositAmount,
      lateFeePerDay,
      minRentalDays: 1,
      maxRentalDays: 30,
    })

  expect(response.status).toBe(201)
  return response.body.data.rentalListing
}

const createAndPayBooking = async ({ renterToken, listingId, startDate, endDate }) => {
  const createResponse = await request(app)
    .post(`${api}/rentals/bookings`)
    .set('Authorization', `Bearer ${renterToken}`)
    .send({ listingId, startDate, endDate })

  expect(createResponse.status).toBe(201)
  const bookingId = createResponse.body.data.rentalBooking._id

  const payResponse = await request(app)
    .post(`${api}/rentals/bookings/${bookingId}/pay`)
    .set('Authorization', `Bearer ${renterToken}`)

  expect(payResponse.status).toBe(200)
  return bookingId
}

describe('rental integration', () => {
  it('settles early return by using actualDays and refunds unused rent to the renter', async () => {
    const [{ user: seller, token: sellerToken }, { user: renter, token: renterToken }, { user: admin }] = await Promise.all([
      createApprovedSeller(),
      loginMember(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedRentalFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 30000 })
    const product = await createSellerProduct(seller._id, { categoryId: category._id, price: 500000, title: 'Rental Vase' })

    await UserWallet.create({ user: renter._id, balance: 1000000, totalTopUp: 1000000 })

    const listing = await createRentalListing({
      ownerToken: sellerToken,
      productId: product._id.toString(),
      dailyRate: 100000,
      depositAmount: 300000,
      lateFeePerDay: 40000,
    })

    const bookingId = await createAndPayBooking({
      renterToken,
      listingId: listing._id,
      startDate: '2026-06-01',
      endDate: '2026-06-05',
    })

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/handover`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Bàn giao đầy đủ' })
      .expect(200)

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/return`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ note: 'Trả sớm hơn dự kiến', returnedAt: '2026-06-03T09:00:00.000Z' })
      .expect(200)

    const confirmResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/confirm-return`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Đã nhận lại sản phẩm' })

    expect(confirmResponse.status).toBe(200)
    expect(confirmResponse.body.data.rentalBooking.status).toBe(RENTAL_BOOKING_STATUS.COMPLETED)

    const [booking, renterWallet, sellerWallet, revenueWallet, clearingWallet, walletTransactions, settlementTx] = await Promise.all([
      RentalBooking.findById(bookingId).lean(),
      UserWallet.findOne({ user: renter._id }).lean(),
      UserWallet.findOne({ user: seller._id }).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
      UserWalletTransaction.find({ user: { $in: [renter._id, seller._id] } }).sort({ createdAt: 1 }).lean(),
      LedgerTransaction.findOne({
        referenceType: LEDGER_REFERENCE_TYPE.RENTAL_BOOKING,
        referenceId: bookingId,
        transactionType: LEDGER_TRANSACTION_TYPE.RENTAL_RETURN_SETTLEMENT,
      }).lean(),
    ])

    expect(booking.actualDays).toBe(3)
    expect(booking.actualRentAmount).toBe(300000)
    expect(booking.unusedRentRefundAmount).toBe(200000)
    expect(booking.platformFeeAmount).toBe(30000)
    expect(booking.ownerSettlementAmount).toBe(270000)
    expect(booking.depositReleasedAmount).toBe(300000)
    expect(renterWallet.balance).toBe(700000)
    expect(sellerWallet.balance).toBe(270000)
    expect(revenueWallet.balance).toBe(30000)
    expect(clearingWallet.balance).toBe(0)
    expect(settlementTx?.platformFee).toBe(30000)
    expect(walletTransactions.map((item) => item.type)).toEqual([
      USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_OWNER_SETTLEMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_UNUSED_REFUND,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE,
    ])
  })

  it('collects late fee correctly when the renter returns after the planned period', async () => {
    const [{ user: seller, token: sellerToken }, { user: renter, token: renterToken }, { user: admin }] = await Promise.all([
      createApprovedSeller(),
      loginMember(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedRentalFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const product = await createSellerProduct(seller._id, { categoryId: category._id, price: 450000, title: 'Rental Lamp' })

    await UserWallet.create({ user: renter._id, balance: 1000000, totalTopUp: 1000000 })

    const listing = await createRentalListing({
      ownerToken: sellerToken,
      productId: product._id.toString(),
      dailyRate: 100000,
      depositAmount: 300000,
      lateFeePerDay: 20000,
    })

    const bookingId = await createAndPayBooking({
      renterToken,
      listingId: listing._id,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    })

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/handover`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Bàn giao cho khách thuê' })
      .expect(200)

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/return`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ note: 'Trả muộn', returnedAt: '2026-06-04T11:00:00.000Z' })
      .expect(200)

    const confirmResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/confirm-return`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Xác nhận trả muộn' })

    expect(confirmResponse.status).toBe(200)

    const [booking, renterWallet, sellerWallet, revenueWallet, clearingWallet, walletTransactions] = await Promise.all([
      RentalBooking.findById(bookingId).lean(),
      UserWallet.findOne({ user: renter._id }).lean(),
      UserWallet.findOne({ user: seller._id }).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
      UserWalletTransaction.find({ user: { $in: [renter._id, seller._id] } }).sort({ createdAt: 1 }).lean(),
    ])

    expect(booking.actualDays).toBe(4)
    expect(booking.actualRentAmount).toBe(400000)
    expect(booking.lateFeeAmount).toBe(40000)
    expect(booking.unusedRentRefundAmount).toBe(0)
    expect(booking.platformFeeAmount).toBe(20000)
    expect(booking.ownerSettlementAmount).toBe(420000)
    expect(renterWallet.balance).toBe(560000)
    expect(sellerWallet.balance).toBe(420000)
    expect(revenueWallet.balance).toBe(20000)
    expect(clearingWallet.balance).toBe(0)
    expect(walletTransactions.map((item) => item.type)).toEqual([
      USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_ADDITIONAL_RENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_LATE_FEE,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_OWNER_SETTLEMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE,
    ])
  })

  it('keeps deposit held while a claim is open and only releases it after admin resolution', async () => {
    const [{ user: seller, token: sellerToken }, { user: renter, token: renterToken }, { user: admin, token: adminToken }] = await Promise.all([
      createApprovedSeller(),
      loginMember(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedRentalFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const product = await createSellerProduct(seller._id, { categoryId: category._id, price: 550000, title: 'Rental Mirror' })

    await UserWallet.create({ user: renter._id, balance: 1000000, totalTopUp: 1000000 })

    const listing = await createRentalListing({
      ownerToken: sellerToken,
      productId: product._id.toString(),
      dailyRate: 100000,
      depositAmount: 300000,
      lateFeePerDay: 20000,
    })

    const bookingId = await createAndPayBooking({
      renterToken,
      listingId: listing._id,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    })

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/handover`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Bàn giao bình thường' })
      .expect(200)

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/return`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ note: 'Trả đúng hạn', returnedAt: '2026-06-02T09:00:00.000Z' })
      .expect(200)

    const claimResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/claims`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        reason: 'Sản phẩm bị trầy xước sau khi nhận lại',
        requestedAmount: 50000,
      })

    expect(claimResponse.status).toBe(201)
    const claimId = claimResponse.body.data.rentalClaim._id

    const confirmResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/confirm-return`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Xác nhận giữ cọc vì đang có claim' })

    expect(confirmResponse.status).toBe(200)
    expect(confirmResponse.body.data.rentalBooking.status).toBe(RENTAL_BOOKING_STATUS.DISPUTED)

    const [bookingAfterReturn, claimAfterReturn, renterWalletAfterReturn, sellerWalletAfterReturn, clearingWalletAfterReturn, revenueWalletAfterReturn] =
      await Promise.all([
        RentalBooking.findById(bookingId).lean(),
        RentalClaim.findById(claimId).lean(),
        UserWallet.findOne({ user: renter._id }).lean(),
        UserWallet.findOne({ user: seller._id }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
      ])

    expect(bookingAfterReturn.depositReleasedAmount).toBe(0)
    expect(bookingAfterReturn.status).toBe(RENTAL_BOOKING_STATUS.DISPUTED)
    expect(claimAfterReturn.status).toBe(RENTAL_CLAIM_STATUS.UNDER_ADMIN_REVIEW)
    expect(renterWalletAfterReturn.balance).toBe(500000)
    expect(sellerWalletAfterReturn.balance).toBe(180000)
    expect(revenueWalletAfterReturn.balance).toBe(20000)
    expect(clearingWalletAfterReturn.balance).toBe(300000)

    const resolveResponse = await request(app)
      .post(`${api}/admin/rental-claims/${claimId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        approvedAmount: 50000,
        note: 'Duyệt giữ lại một phần cọc',
      })

    expect(resolveResponse.status).toBe(200)

    const [bookingAfterResolve, claimAfterResolve, renterWalletAfterResolve, sellerWalletAfterResolve, clearingWalletAfterResolve, walletTransactions] =
      await Promise.all([
        RentalBooking.findById(bookingId).lean(),
        RentalClaim.findById(claimId).lean(),
        UserWallet.findOne({ user: renter._id }).lean(),
        UserWallet.findOne({ user: seller._id }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
        UserWalletTransaction.find({ user: { $in: [renter._id, seller._id] } }).sort({ createdAt: 1 }).lean(),
      ])

    expect(bookingAfterResolve.status).toBe(RENTAL_BOOKING_STATUS.COMPLETED)
    expect(bookingAfterResolve.claimDeductionAmount).toBe(50000)
    expect(bookingAfterResolve.depositReleasedAmount).toBe(250000)
    expect(claimAfterResolve.status).toBe(RENTAL_CLAIM_STATUS.APPROVED)
    expect(renterWalletAfterResolve.balance).toBe(750000)
    expect(sellerWalletAfterResolve.balance).toBe(230000)
    expect(clearingWalletAfterResolve.balance).toBe(0)
    expect(walletTransactions.map((item) => item.type)).toEqual([
      USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_OWNER_SETTLEMENT,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_CLAIM_DEDUCTION,
      USER_WALLET_TRANSACTION_TYPE.RENTAL_DEPOSIT_RELEASE,
    ])
  })

  it('supports idempotent retry for rental payment and admin claim resolution while exposing reconciliation summary', async () => {
    const [{ user: seller, token: sellerToken }, { user: renter, token: renterToken }, { user: admin, token: adminToken }] = await Promise.all([
      createApprovedSeller(),
      loginMember(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedRentalFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const product = await createSellerProduct(seller._id, { categoryId: category._id, price: 750000, title: 'Rental Lamp' })

    await UserWallet.create({ user: renter._id, balance: 1000000, totalTopUp: 1000000 })

    const listing = await createRentalListing({
      ownerToken: sellerToken,
      productId: product._id.toString(),
      dailyRate: 100000,
      depositAmount: 300000,
      lateFeePerDay: 25000,
    })

    const createResponse = await request(app)
      .post(`${api}/rentals/bookings`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ listingId: listing._id, startDate: '2026-06-10', endDate: '2026-06-11' })

    expect(createResponse.status).toBe(201)
    const bookingId = createResponse.body.data.rentalBooking._id

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${renterToken}`)
      .expect(200)

    const secondPayResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/pay`)
      .set('Authorization', `Bearer ${renterToken}`)

    expect(secondPayResponse.status).toBe(200)
    expect(secondPayResponse.body.data.rentalBooking.status).toBe(RENTAL_BOOKING_STATUS.CONFIRMED)

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/handover`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Bàn giao đủ phụ kiện' })
      .expect(200)

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/return`)
      .set('Authorization', `Bearer ${renterToken}`)
      .send({ note: 'Trả đúng hạn', returnedAt: '2026-06-11T09:00:00.000Z' })
      .expect(200)

    const claimResponse = await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/claims`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ reason: 'Thiếu một phụ kiện đi kèm', requestedAmount: 70000 })

    expect(claimResponse.status).toBe(201)
    const claimId = claimResponse.body.data.rentalClaim._id

    await request(app)
      .post(`${api}/rentals/bookings/${bookingId}/confirm-return`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ note: 'Giữ cọc để chờ admin review claim' })
      .expect(200)

    await request(app)
      .post(`${api}/admin/rental-claims/${claimId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approvedAmount: 70000, note: 'Duyệt claim lần đầu' })
      .expect(200)

    const secondResolveResponse = await request(app)
      .post(`${api}/admin/rental-claims/${claimId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approvedAmount: 70000, note: 'Retry resolve cùng payload' })

    expect(secondResolveResponse.status).toBe(200)
    expect(secondResolveResponse.body.data.rentalClaim.status).toBe(RENTAL_CLAIM_STATUS.APPROVED)

    const reconciliationResponse = await request(app)
      .get(`${api}/admin/platform-ledger/reconciliation`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(reconciliationResponse.status).toBe(200)
    expect(reconciliationResponse.body.data.issueCounts.stuckSettlements).toBeGreaterThanOrEqual(0)

    const [renterWallet, paymentTransactions, claimSettlementTx] = await Promise.all([
      UserWallet.findOne({ user: renter._id }).lean(),
      UserWalletTransaction.find({ user: renter._id, type: USER_WALLET_TRANSACTION_TYPE.RENTAL_PAYMENT }).lean(),
      LedgerTransaction.findOne({
        referenceType: LEDGER_REFERENCE_TYPE.RENTAL_CLAIM,
        referenceId: claimId,
        transactionType: LEDGER_TRANSACTION_TYPE.RENTAL_CLAIM_SETTLEMENT,
      }).lean(),
    ])

    expect(paymentTransactions).toHaveLength(1)
    expect(renterWallet.balance).toBe(730000)
    expect(claimSettlementTx?.netSettlementAmount).toBe(70000)
  })

  it('allows shop owner to create a rental listing and read booking detail for a shop-owned product', async () => {
    const [{ user: shopOwner, token: shopToken }, { user: renter, token: renterToken }, { user: admin }] = await Promise.all([
      loginShopOwner(),
      loginMember(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedRentalFeePolicy({ adminId: admin._id, categoryId: category._id, ownerType: 'SHOP', fixedFee: 15000 })
    const shop = await createSampleShop({ owner: shopOwner._id })
    const product = await createShopOwnedProduct(shop, { categoryId: category._id, price: 650000, title: 'Shop Rental Shelf' })

    await UserWallet.create({ user: renter._id, balance: 1000000, totalTopUp: 1000000 })

    const listing = await createRentalListing({
      ownerToken: shopToken,
      productId: product._id.toString(),
      ownerType: 'SHOP',
      shopId: shop._id.toString(),
      dailyRate: 120000,
      depositAmount: 250000,
      lateFeePerDay: 30000,
    })

    const bookingId = await createAndPayBooking({
      renterToken,
      listingId: listing._id,
      startDate: '2026-06-10',
      endDate: '2026-06-12',
    })

    const detailResponse = await request(app)
      .get(`${api}/rentals/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${shopToken}`)

    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.data.rentalBooking.ownerType).toBe('SHOP')
    expect(detailResponse.body.data.rentalBooking.shop?._id || detailResponse.body.data.rentalBooking.shop).toBe(shop._id.toString())
  })
})
