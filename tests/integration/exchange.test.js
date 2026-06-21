/* eslint-env jest */

import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginAdmin, loginSeller } from '../setup/auth.js'
import { createSampleCategory } from '../setup/factories.js'
import Product, { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletTransaction from '../../src/models/user-wallet-transaction.model.js'
import LedgerTransaction from '../../src/models/ledger-transaction.model.js'
import LedgerEntry from '../../src/models/ledger-entry.model.js'
import PlatformWallet from '../../src/models/platform-wallet.model.js'
import ExchangeOffer from '../../src/models/exchange-offer.model.js'
import FeePolicy from '../../src/models/fee-policy.model.js'
import { EXCHANGE_STATUS, FEE_POLICY_STATUS, PRODUCT_STATUS, USER_WALLET_TRANSACTION_TYPE } from '../../src/constants/status.constant.js'
import {
  LEDGER_ENTRY_DIRECTION,
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
    title: title || `Seller Product ${Math.random().toString(36).slice(2, 7)}`,
    description: 'Integration fixture for exchange flow.',
    price: price ?? 100000,
    stock: 1,
    listingType: 'sell',
    transactionMode: 'exchange',
    condition: 'good',
    category: categoryId,
    owner: sellerId,
    ownerType: PRODUCT_OWNER_TYPES.SELLER,
    seller: sellerId,
    shop: null,
    status: PRODUCT_STATUS.AVAILABLE,
    images: [{ url: 'https://example.com/exchange-test.png', publicId: 'exchange-test' }],
    location: { province: 'Test Province', district: 'Test District' },
  })

const seedExchangeFeePolicy = ({ adminId, categoryId, fixedFee = 20000 }) =>
  FeePolicy.create({
    transactionType: 'EXCHANGE',
    ownerType: 'SELLER',
    categoryId,
    minAmount: 0,
    maxAmount: null,
    percent: 0,
    minFee: 0,
    maxFee: null,
    fixedFee,
    baseAmountType: 'EXCHANGE_CASH_DIFFERENCE',
    rounding: 'ROUND',
    status: FEE_POLICY_STATUS.ACTIVE,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    createdByAdminId: adminId,
    updatedByAdminId: adminId,
  })

describe('exchange integration', () => {
  it('holds exchange payment, completes settlement, and releases fee plus cash difference on completion', async () => {
    const [{ user: requester, token: requesterToken }, { user: receiver, token: receiverToken }, { user: admin }] =
      await Promise.all([createApprovedSeller(), createApprovedSeller(), loginAdmin()])

    const category = await createSampleCategory()
    await seedExchangeFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const [requesterProduct, receiverProduct] = await Promise.all([
      createSellerProduct(requester._id, { categoryId: category._id, price: 500000, title: 'Requester Vase' }),
      createSellerProduct(receiver._id, { categoryId: category._id, price: 800000, title: 'Receiver Lamp' }),
    ])

    await Promise.all([
      UserWallet.create({ user: requester._id, balance: 1000000, totalTopUp: 1000000 }),
      UserWallet.create({ user: receiver._id, balance: 50000, totalTopUp: 50000 }),
    ])

    const createResponse = await request(app)
      .post(`${api}/exchanges/offers`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requesterProductId: requesterProduct._id.toString(),
        receiverProductId: receiverProduct._id.toString(),
        note: 'Requester proposes exchange with cash difference',
      })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.data.exchangeOffer.cashDifferenceAmount).toBe(300000)
    expect(createResponse.body.data.exchangeOffer.platformFee).toBe(20000)

    const exchangeOfferId = createResponse.body.data.exchangeOffer._id

    const acceptResponse = await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`)

    expect(acceptResponse.status).toBe(200)
    expect(acceptResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.ACCEPTED)

    const payResponse = await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/pay`)
      .set('Authorization', `Bearer ${requesterToken}`)

    expect(payResponse.status).toBe(200)
    expect(payResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.PAID)

    const requesterWalletAfterHold = await UserWallet.findOne({ user: requester._id }).lean()
    const holdTx = await LedgerTransaction.findOne({
      referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
      referenceId: exchangeOfferId,
      transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_PAYMENT_HOLD,
    }).lean()
    const clearingAfterHold = await PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean()
    const holdEntries = await LedgerEntry.find({ ledgerTransaction: holdTx._id }).lean()

    expect(requesterWalletAfterHold.balance).toBe(680000)
    expect(holdTx.grossAmount).toBe(320000)
    expect(holdTx.platformFee).toBe(20000)
    expect(holdTx.netSettlementAmount).toBe(300000)
    expect(clearingAfterHold.balance).toBe(320000)
    expect(holdEntries).toHaveLength(1)
    expect(holdEntries[0].direction).toBe(LEDGER_ENTRY_DIRECTION.CREDIT)
    expect(holdEntries[0].amount).toBe(320000)

    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/ship`)
      .set('Authorization', `Bearer ${requesterToken}`)
    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/ship`)
      .set('Authorization', `Bearer ${receiverToken}`)

    const firstConfirmResponse = await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/confirm-received`)
      .set('Authorization', `Bearer ${requesterToken}`)

    expect(firstConfirmResponse.status).toBe(200)
    expect(firstConfirmResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.SHIPPED)

    const secondConfirmResponse = await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/confirm-received`)
      .set('Authorization', `Bearer ${receiverToken}`)

    expect(secondConfirmResponse.status).toBe(200)
    expect(secondConfirmResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.COMPLETED)

    const [completedOffer, releaseTx, releaseEntries, requesterProductAfter, receiverProductAfter, revenueWallet, clearingWallet, receiverWallet, walletTransactions] =
      await Promise.all([
        ExchangeOffer.findById(exchangeOfferId).lean(),
        LedgerTransaction.findOne({
          referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
          referenceId: exchangeOfferId,
          transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT_RELEASE,
        }).lean(),
        LedgerEntry.find({}).lean(),
        Product.findById(requesterProduct._id).lean(),
        Product.findById(receiverProduct._id).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
        UserWallet.findOne({ user: receiver._id }).lean(),
        UserWalletTransaction.find({ user: { $in: [requester._id, receiver._id] } }).sort({ createdAt: 1 }).lean(),
      ])

    const releaseEntriesForTx = releaseEntries.filter((entry) => String(entry.ledgerTransaction) === String(releaseTx._id))

    expect(completedOffer.status).toBe(EXCHANGE_STATUS.COMPLETED)
    expect(releaseTx.grossAmount).toBe(320000)
    expect(releaseTx.platformFee).toBe(20000)
    expect(releaseEntriesForTx).toHaveLength(3)
    expect(revenueWallet.balance).toBe(20000)
    expect(clearingWallet.balance).toBe(0)
    expect(receiverWallet.balance).toBe(350000)
    expect(requesterProductAfter.status).toBe(PRODUCT_STATUS.SOLD)
    expect(receiverProductAfter.status).toBe(PRODUCT_STATUS.SOLD)
    expect(walletTransactions.map((item) => item.type)).toEqual([
      USER_WALLET_TRANSACTION_TYPE.EXCHANGE_PAYMENT,
      USER_WALLET_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT,
    ])
  })

  it('keeps exchange hold in clearing while the dispute is still open', async () => {
    const [{ user: requester, token: requesterToken }, { user: receiver, token: receiverToken }, { user: admin }] =
      await Promise.all([createApprovedSeller(), createApprovedSeller(), loginAdmin()])

    const category = await createSampleCategory()
    await seedExchangeFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const [requesterProduct, receiverProduct] = await Promise.all([
      createSellerProduct(requester._id, { categoryId: category._id, price: 400000, title: 'Requester Mirror' }),
      createSellerProduct(receiver._id, { categoryId: category._id, price: 700000, title: 'Receiver Shelf' }),
    ])

    await Promise.all([
      UserWallet.create({ user: requester._id, balance: 1000000, totalTopUp: 1000000 }),
      UserWallet.create({ user: receiver._id, balance: 120000, totalTopUp: 120000 }),
    ])

    const createResponse = await request(app)
      .post(`${api}/exchanges/offers`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requesterProductId: requesterProduct._id.toString(),
        receiverProductId: receiverProduct._id.toString(),
        note: 'Create dispute scenario',
      })

    const exchangeOfferId = createResponse.body.data.exchangeOffer._id

    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`)
    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/pay`)
      .set('Authorization', `Bearer ${requesterToken}`)

    const disputeResponse = await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/dispute`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ reason: 'Receiver reports issue before completion' })

    expect(disputeResponse.status).toBe(200)
    expect(disputeResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.DISPUTED)

    const [exchangeOffer, clearingWallet, revenueWallet, releaseTx, refundTx, receiverWallet] = await Promise.all([
      ExchangeOffer.findById(exchangeOfferId).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
      PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
      LedgerTransaction.findOne({
        referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
        referenceId: exchangeOfferId,
        transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT_RELEASE,
      }).lean(),
      LedgerTransaction.findOne({
        referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
        referenceId: exchangeOfferId,
        transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_REFUND,
      }).lean(),
      UserWallet.findOne({ user: receiver._id }).lean(),
    ])

    expect(exchangeOffer.status).toBe(EXCHANGE_STATUS.DISPUTED)
    expect(clearingWallet.balance).toBe(320000)
    expect(revenueWallet).toBeNull()
    expect(releaseTx).toBeNull()
    expect(refundTx).toBeNull()
    expect(receiverWallet.balance).toBe(120000)
  })

  it('allows admin to resolve a disputed exchange with cancel_refund and returns held money to payer wallet', async () => {
    const [{ user: requester, token: requesterToken }, { user: receiver, token: receiverToken }, { user: admin, token: adminToken }] =
      await Promise.all([createApprovedSeller(), createApprovedSeller(), loginAdmin()])

    const category = await createSampleCategory()
    await seedExchangeFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })
    const [requesterProduct, receiverProduct] = await Promise.all([
      createSellerProduct(requester._id, { categoryId: category._id, price: 450000, title: 'Requester Clock' }),
      createSellerProduct(receiver._id, { categoryId: category._id, price: 750000, title: 'Receiver Cabinet' }),
    ])

    await Promise.all([
      UserWallet.create({ user: requester._id, balance: 1000000, totalTopUp: 1000000 }),
      UserWallet.create({ user: receiver._id, balance: 150000, totalTopUp: 150000 }),
    ])

    const createResponse = await request(app)
      .post(`${api}/exchanges/offers`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requesterProductId: requesterProduct._id.toString(),
        receiverProductId: receiverProduct._id.toString(),
        note: 'Create refund resolution scenario',
      })

    const exchangeOfferId = createResponse.body.data.exchangeOffer._id

    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/accept`)
      .set('Authorization', `Bearer ${receiverToken}`)
    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/pay`)
      .set('Authorization', `Bearer ${requesterToken}`)
    await request(app)
      .post(`${api}/exchanges/offers/${exchangeOfferId}/dispute`)
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ reason: 'Receiver opened dispute for refund resolution' })

    const resolveResponse = await request(app)
      .post(`${api}/admin/exchanges/${exchangeOfferId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        resolution: 'cancel_refund',
        note: 'Admin cancels exchange and refunds held amount',
      })

    expect(resolveResponse.status).toBe(200)
    expect(resolveResponse.body.data.exchangeOffer.status).toBe(EXCHANGE_STATUS.CANCELLED)
    expect(resolveResponse.body.data.exchangeOffer.resolution).toBe('cancel_refund')

    const [exchangeOffer, requesterWallet, receiverWallet, clearingWallet, revenueWallet, refundTx, releaseTx, requesterProductAfter, receiverProductAfter, walletTransactions] =
      await Promise.all([
        ExchangeOffer.findById(exchangeOfferId).lean(),
        UserWallet.findOne({ user: requester._id }).lean(),
        UserWallet.findOne({ user: receiver._id }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.CLEARING }).lean(),
        PlatformWallet.findOne({ walletKey: PLATFORM_WALLET_KEYS.REVENUE }).lean(),
        LedgerTransaction.findOne({
          referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
          referenceId: exchangeOfferId,
          transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_REFUND,
        }).lean(),
        LedgerTransaction.findOne({
          referenceType: LEDGER_REFERENCE_TYPE.EXCHANGE,
          referenceId: exchangeOfferId,
          transactionType: LEDGER_TRANSACTION_TYPE.EXCHANGE_SETTLEMENT_RELEASE,
        }).lean(),
        Product.findById(requesterProduct._id).lean(),
        Product.findById(receiverProduct._id).lean(),
        UserWalletTransaction.find({ user: requester._id }).sort({ createdAt: 1 }).lean(),
      ])

    expect(exchangeOffer.status).toBe(EXCHANGE_STATUS.CANCELLED)
    expect(exchangeOffer.resolution).toBe('cancel_refund')
    expect(requesterWallet.balance).toBe(1000000)
    expect(receiverWallet.balance).toBe(150000)
    expect(clearingWallet.balance).toBe(0)
    expect(revenueWallet).toBeNull()
    expect(refundTx?.grossAmount).toBe(320000)
    expect(releaseTx).toBeNull()
    expect(requesterProductAfter.status).toBe(PRODUCT_STATUS.AVAILABLE)
    expect(receiverProductAfter.status).toBe(PRODUCT_STATUS.AVAILABLE)
    expect(walletTransactions.map((item) => item.type)).toEqual([
      USER_WALLET_TRANSACTION_TYPE.EXCHANGE_PAYMENT,
      USER_WALLET_TRANSACTION_TYPE.EXCHANGE_REFUND,
    ])
  })

  it('rejects exchange offers that involve shop-owned products', async () => {
    const [{ user: requester, token: requesterToken }, { user: shopSeller }, { user: admin }] = await Promise.all([
      createApprovedSeller(),
      createApprovedSeller(),
      loginAdmin(),
    ])

    const category = await createSampleCategory()
    await seedExchangeFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 20000 })

    const requesterProduct = await createSellerProduct(requester._id, {
      categoryId: category._id,
      price: 500000,
      title: 'Requester Chair',
    })

    const shopOwnedProduct = await Product.create({
      title: 'Shop-Owned Table',
      description: 'Shop product should not be exchange eligible.',
      price: 650000,
      stock: 1,
      listingType: 'sell',
      transactionMode: 'sell',
      condition: 'good',
      category: category._id,
      owner: shopSeller._id,
      ownerType: PRODUCT_OWNER_TYPES.SHOP,
      seller: null,
      shop: new Product.base.Types.ObjectId(),
      status: PRODUCT_STATUS.AVAILABLE,
      images: [{ url: 'https://example.com/shop-product.png', publicId: 'shop-product' }],
      location: { province: 'Test Province', district: 'Test District' },
    })

    const response = await request(app)
      .post(`${api}/exchanges/offers`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requesterProductId: requesterProduct._id.toString(),
        receiverProductId: shopOwnedProduct._id.toString(),
        note: 'Attempt exchange with shop product',
      })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('previews exchange settlement for eligible exchange products', async () => {
    const [{ user: requester, token: requesterToken }, { user: receiver }, { user: admin }] =
      await Promise.all([createApprovedSeller(), createApprovedSeller(), loginAdmin()])

    const category = await createSampleCategory()
    await seedExchangeFeePolicy({ adminId: admin._id, categoryId: category._id, fixedFee: 15000 })
    const [requesterProduct, receiverProduct] = await Promise.all([
      createSellerProduct(requester._id, { categoryId: category._id, price: 550000, title: 'Requester Bench' }),
      createSellerProduct(receiver._id, { categoryId: category._id, price: 700000, title: 'Receiver Shelf' }),
    ])

    const response = await request(app)
      .post(`${api}/exchanges/offers/preview`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        requesterProductId: requesterProduct._id.toString(),
        receiverProductId: receiverProduct._id.toString(),
      })

    expect(response.status).toBe(200)
    expect(response.body.data.preview.eligibility.canCreateOffer).toBe(true)
    expect(response.body.data.preview.requesterProductValue).toBe(550000)
    expect(response.body.data.preview.receiverProductValue).toBe(700000)
    expect(response.body.data.preview.cashDifferenceAmount).toBe(150000)
    expect(response.body.data.preview.platformFee).toBe(15000)
  })
})
