import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/server.js'
import User from '../src/models/user.model.js'
import Shop from '../src/models/shop.model.js'
import Order from '../src/models/order.model.js'
import Wallet from '../src/models/wallet.model.js'
import WalletTransaction from '../src/models/wallet-transaction.model.js'
import WithdrawalRequest from '../src/models/withdrawal-request.model.js'
import { creditFromOrder } from '../src/services/wallet/wallet.service.js'
import { createToken } from './fixtures/testData.js'

let shopOwner, admin, staff, outsider
let ownerToken, adminToken, staffToken, outsiderToken
let shop

const BANK_INFO = {
  bankName: 'Vietcombank',
  accountNumber: '1234567890',
  accountName: 'SHOP OWNER TEST',
  bankBranch: 'Ha Noi',
}

const WITHDRAWAL_PAYLOAD = {
  amount: 50000,
  bankInfo: BANK_INFO,
  note: 'Test withdrawal',
}

describe('Wallet API', () => {
  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Shop.deleteMany({}),
      Order.deleteMany({}),
      Wallet.deleteMany({}),
      WalletTransaction.deleteMany({}),
      WithdrawalRequest.deleteMany({}),
    ])

    shopOwner = await User.create({
      name: 'Shop Owner',
      email: 'owner-wallet@example.com',
      password: '123456',
      role: 'shop_owner',
      roles: ['shop_owner'],
    })

    admin = await User.create({
      name: 'Admin',
      email: 'admin-wallet@example.com',
      password: '123456',
      role: 'admin',
      roles: ['admin'],
    })

    staff = await User.create({
      name: 'Staff',
      email: 'staff-wallet@example.com',
      password: '123456',
      role: 'staff',
      roles: ['staff'],
    })

    outsider = await User.create({
      name: 'Outsider',
      email: 'outsider-wallet@example.com',
      password: '123456',
      roles: ['member'],
    })

    ownerToken = await createToken(shopOwner._id, 'shop_owner')
    adminToken = await createToken(admin._id, 'admin')
    staffToken = await createToken(staff._id, 'staff')
    outsiderToken = await createToken(outsider._id, 'member')

    shop = await Shop.create({
      name: 'Wallet Test Shop',
      slug: 'wallet-test-shop',
      owner: shopOwner._id,
      staff: [staff._id],
      isActive: true,
    })
  })

  // ─── GET /api/v1/wallet/shops/:shopId ──────────────────────────────────────

  describe('GET /api/v1/wallet/shops/:shopId', () => {
    it('returns zero-balance object when no wallet document exists', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.balance).toBe(0)
    })

    it('returns wallet data when wallet exists', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000, totalEarned: 200000 })

      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.balance).toBe(200000)
      expect(res.body.data.totalEarned).toBe(200000)
    })

    it('admin can view wallet of any shop', async () => {
      await Wallet.create({ shop: shop._id, balance: 100000 })

      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.balance).toBe(100000)
    })

    it('staff cannot view wallet (no WALLET_VIEW permission)', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}`)
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('outsider cannot view wallet of another shop', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)

      expect(res.statusCode).toBe(403)
    })

    it('unauthenticated request returns 401', async () => {
      const res = await request(app).get(`/api/v1/wallet/shops/${shop._id}`)

      expect(res.statusCode).toBe(401)
    })

    it('returns 404 when shopId does not exist', async () => {
      const fakeId = '000000000000000000000000'
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(404)
      expect(res.body.success).toBe(false)
    })
  })

  // ─── GET /api/v1/wallet/shops/:shopId/transactions ─────────────────────────

  describe('GET /api/v1/wallet/shops/:shopId/transactions', () => {
    it('returns empty list when no transactions', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/transactions`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.meta.pagination.total).toBe(0)
    })

    it('returns transactions with pagination meta', async () => {
      const wallet = await Wallet.create({ shop: shop._id, balance: 95000, totalEarned: 100000 })
      await WalletTransaction.create({
        wallet: wallet._id,
        shop: shop._id,
        type: 'credit',
        grossAmount: 100000,
        platformFee: 5000,
        netAmount: 95000,
        description: 'Đơn hàng test',
      })

      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/transactions`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.meta.pagination.total).toBe(1)
      expect(res.body.data[0].type).toBe('credit')
      expect(res.body.data[0].netAmount).toBe(95000)
    })

    it('admin can view transactions', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/transactions`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
    })

    it('staff cannot view transactions', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/transactions`)
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.statusCode).toBe(403)
    })

    it('pagination returns correct page and limit', async () => {
      const wallet = await Wallet.create({ shop: shop._id })
      await WalletTransaction.create([
        { wallet: wallet._id, shop: shop._id, type: 'credit', grossAmount: 100000, platformFee: 5000, netAmount: 95000, description: 'tx1' },
        { wallet: wallet._id, shop: shop._id, type: 'credit', grossAmount: 200000, platformFee: 10000, netAmount: 190000, description: 'tx2' },
        { wallet: wallet._id, shop: shop._id, type: 'credit', grossAmount: 300000, platformFee: 15000, netAmount: 285000, description: 'tx3' },
      ])

      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/transactions?page=2&limit=1`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.meta.pagination.total).toBe(3)
      expect(res.body.meta.pagination.page).toBe(2)
    })
  })

  // ─── POST /api/v1/wallet/shops/:shopId/withdrawals ─────────────────────────

  describe('POST /api/v1/wallet/shops/:shopId/withdrawals', () => {
    it('owner creates withdrawal when balance is sufficient', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(WITHDRAWAL_PAYLOAD)

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.amount).toBe(WITHDRAWAL_PAYLOAD.amount)
      expect(res.body.data.status).toBe('pending')
      expect(res.body.data.bankInfo.bankName).toBe('Vietcombank')
    })

    it('deducts balance from wallet after creating withdrawal', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(WITHDRAWAL_PAYLOAD)

      const wallet = await Wallet.findOne({ shop: shop._id })
      expect(wallet.balance).toBe(200000 - WITHDRAWAL_PAYLOAD.amount)
      expect(wallet.pendingBalance).toBe(WITHDRAWAL_PAYLOAD.amount)
    })

    it('returns 400 when balance is insufficient', async () => {
      await Wallet.create({ shop: shop._id, balance: 10000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ...WITHDRAWAL_PAYLOAD, amount: 50000 })

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 400 when a pending withdrawal already exists', async () => {
      await Wallet.create({ shop: shop._id, balance: 500000 })
      await WithdrawalRequest.create({
        shop: shop._id,
        wallet: (await Wallet.findOne({ shop: shop._id }))._id,
        requestedBy: shopOwner._id,
        amount: 50000,
        bankInfo: BANK_INFO,
        status: 'pending',
      })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(WITHDRAWAL_PAYLOAD)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('staff cannot create withdrawal (no WALLET_REQUEST_WITHDRAWAL permission)', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(WITHDRAWAL_PAYLOAD)

      expect(res.statusCode).toBe(403)
    })

    it('admin cannot request withdrawal on a shop they do not own', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(WITHDRAWAL_PAYLOAD)

      expect(res.statusCode).toBe(403)
    })

    it('returns 422 when amount is below minimum (< 50000)', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ...WITHDRAWAL_PAYLOAD, amount: 5000 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when amount exceeds maximum (> 50000000)', async () => {
      await Wallet.create({ shop: shop._id, balance: 100000000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ ...WITHDRAWAL_PAYLOAD, amount: 60000000 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('returns 422 when bankInfo is missing', async () => {
      await Wallet.create({ shop: shop._id, balance: 200000 })

      const res = await request(app)
        .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 50000 })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    describe('Withdrawal Amount Validation', () => {
      it('accepts withdrawal at minimum amount (50000)', async () => {
        await Wallet.create({ shop: shop._id, balance: 100000 })

        const res = await request(app)
          .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ ...WITHDRAWAL_PAYLOAD, amount: 50000 })

        expect(res.statusCode).toBe(201)
        expect(res.body.data.amount).toBe(50000)
      })

      it('accepts withdrawal at maximum amount (50000000)', async () => {
        await Wallet.create({ shop: shop._id, balance: 60000000 })

        const res = await request(app)
          .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ ...WITHDRAWAL_PAYLOAD, amount: 50000000 })

        expect(res.statusCode).toBe(201)
        expect(res.body.data.amount).toBe(50000000)
      })

      it('rejects withdrawal below minimum (49999)', async () => {
        await Wallet.create({ shop: shop._id, balance: 100000 })

        const res = await request(app)
          .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ ...WITHDRAWAL_PAYLOAD, amount: 49999 })

        expect(res.statusCode).toBe(422)
        expect(res.body.success).toBe(false)
      })

      it('rejects withdrawal above maximum (50000001)', async () => {
        await Wallet.create({ shop: shop._id, balance: 60000000 })

        const res = await request(app)
          .post(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ ...WITHDRAWAL_PAYLOAD, amount: 50000001 })

        expect(res.statusCode).toBe(422)
        expect(res.body.success).toBe(false)
      })
    })
  })

  // ─── GET /api/v1/wallet/shops/:shopId/withdrawals ──────────────────────────

  describe('GET /api/v1/wallet/shops/:shopId/withdrawals', () => {
    let wallet

    beforeEach(async () => {
      wallet = await Wallet.create({ shop: shop._id, balance: 150000 })
      await WithdrawalRequest.create({
        shop: shop._id,
        wallet: wallet._id,
        requestedBy: shopOwner._id,
        amount: 50000,
        bankInfo: BANK_INFO,
        status: 'pending',
      })
      await WithdrawalRequest.create({
        shop: shop._id,
        wallet: wallet._id,
        requestedBy: shopOwner._id,
        amount: 30000,
        bankInfo: BANK_INFO,
        status: 'completed',
      })
    })

    it('owner can list withdrawals for their shop', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
      expect(res.body.meta.pagination.total).toBe(2)
    })

    it('admin can list withdrawals', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(2)
    })

    it('staff cannot list withdrawals', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/withdrawals`)
        .set('Authorization', `Bearer ${staffToken}`)

      expect(res.statusCode).toBe(403)
    })

    it('filters by status query param', async () => {
      const res = await request(app)
        .get(`/api/v1/wallet/shops/${shop._id}/withdrawals?status=pending`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].status).toBe('pending')
    })
  })

  // ─── creditFromOrder (service layer) ──────────────────────────────────────

  describe('creditFromOrder', () => {
    const PLATFORM_FEE_RATE = 0.05
    let buyer

    beforeEach(async () => {
      buyer = await User.create({
        name: 'Buyer',
        email: 'buyer-wallet@example.com',
        password: '123456',
        roles: ['member'],
      })
    })

    it('credits netAmount to wallet and creates CREDIT transaction', async () => {
      const order = await Order.create({
        buyer: buyer._id,
        shop: shop._id,
        product: new mongoose.Types.ObjectId(),
        unitPrice: 100000,
        totalAmount: 100000,
      })

      await creditFromOrder(order)

      const wallet = await Wallet.findOne({ shop: shop._id })
      const expectedNet = Math.round(100000 * (1 - PLATFORM_FEE_RATE))
      expect(wallet.balance).toBe(expectedNet)
      expect(wallet.totalEarned).toBe(expectedNet)

      const tx = await WalletTransaction.findOne({ shop: shop._id, type: 'credit' })
      expect(tx).not.toBeNull()
      expect(tx.netAmount).toBe(expectedNet)
      expect(tx.platformFee).toBe(Math.round(100000 * PLATFORM_FEE_RATE))
      expect(tx.grossAmount).toBe(100000)
    })

    it('is idempotent — calling twice with same order only credits once', async () => {
      const order = await Order.create({
        buyer: buyer._id,
        shop: shop._id,
        product: new mongoose.Types.ObjectId(),
        unitPrice: 200000,
        totalAmount: 200000,
      })

      await creditFromOrder(order)
      await creditFromOrder(order)

      const wallet = await Wallet.findOne({ shop: shop._id })
      const expectedNet = Math.round(200000 * (1 - PLATFORM_FEE_RATE))
      expect(wallet.balance).toBe(expectedNet)

      const txCount = await WalletTransaction.countDocuments({ shop: shop._id, type: 'credit' })
      expect(txCount).toBe(1)
    })

    it('accumulates totalEarned across multiple orders', async () => {
      const order1 = await Order.create({
        buyer: buyer._id, shop: shop._id,
        product: new mongoose.Types.ObjectId(),
        unitPrice: 100000, totalAmount: 100000,
      })
      const order2 = await Order.create({
        buyer: buyer._id, shop: shop._id,
        product: new mongoose.Types.ObjectId(),
        unitPrice: 200000, totalAmount: 200000,
      })

      await creditFromOrder(order1)
      await creditFromOrder(order2)

      const wallet = await Wallet.findOne({ shop: shop._id })
      const expectedNet1 = Math.round(100000 * (1 - PLATFORM_FEE_RATE))
      const expectedNet2 = Math.round(200000 * (1 - PLATFORM_FEE_RATE))
      expect(wallet.balance).toBe(expectedNet1 + expectedNet2)
      expect(wallet.totalEarned).toBe(expectedNet1 + expectedNet2)
    })
  })

  // ─── Admin Withdrawal Management ───────────────────────────────────────────

  describe('Admin Withdrawal Management', () => {
    let wallet, withdrawal

    beforeEach(async () => {
      wallet = await Wallet.create({ shop: shop._id, balance: 150000, pendingBalance: 50000 })
      withdrawal = await WithdrawalRequest.create({
        shop: shop._id,
        wallet: wallet._id,
        requestedBy: shopOwner._id,
        amount: 50000,
        bankInfo: BANK_INFO,
        status: 'pending',
      })
    })

    describe('GET /api/v1/admin/withdrawals', () => {
      it('admin retrieves all withdrawal requests', async () => {
        const res = await request(app)
          .get('/api/v1/admin/withdrawals')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.statusCode).toBe(200)
        expect(res.body.data.length).toBe(1)
        expect(res.body.meta.pagination.total).toBe(1)
      })

      it('non-admin cannot access admin withdrawals list', async () => {
        const res = await request(app)
          .get('/api/v1/admin/withdrawals')
          .set('Authorization', `Bearer ${ownerToken}`)

        expect(res.statusCode).toBe(403)
      })

      it('filters by status query param', async () => {
        const res = await request(app)
          .get('/api/v1/admin/withdrawals?status=completed')
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.statusCode).toBe(200)
        expect(res.body.data.length).toBe(0)
        expect(res.body.meta.pagination.total).toBe(0)
      })
    })

    describe('PATCH /api/v1/admin/withdrawals/:id/approve', () => {
      it('admin approves a pending withdrawal', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.statusCode).toBe(200)
        expect(res.body.data.status).toBe('approved')
        expect(res.body.data.approvedBy).toBeDefined()
      })

      it('returns 400 when withdrawal is not in pending status', async () => {
        await WithdrawalRequest.findByIdAndUpdate(withdrawal._id, { status: 'approved' })

        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)

        expect(res.statusCode).toBe(400)
        expect(res.body.success).toBe(false)
      })

      it('non-admin cannot approve withdrawal', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/approve`)
          .set('Authorization', `Bearer ${ownerToken}`)

        expect(res.statusCode).toBe(403)
      })
    })

    describe('PATCH /api/v1/admin/withdrawals/:id/reject', () => {
      it('admin rejects a pending withdrawal and reverts balance', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ rejectionReason: 'Invalid bank details' })

        expect(res.statusCode).toBe(200)
        expect(res.body.data.status).toBe('rejected')
        expect(res.body.data.rejectionReason).toBe('Invalid bank details')

        const updatedWallet = await Wallet.findById(wallet._id)
        expect(updatedWallet.balance).toBe(150000 + 50000)
        expect(updatedWallet.pendingBalance).toBe(0)
      })

      it('returns 400 when withdrawal is not in pending status', async () => {
        await WithdrawalRequest.findByIdAndUpdate(withdrawal._id, { status: 'approved' })

        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ rejectionReason: 'Too late' })

        expect(res.statusCode).toBe(400)
      })

      it('returns 422 when rejectionReason is missing', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})

        expect(res.statusCode).toBe(422)
        expect(res.body.success).toBe(false)
      })
    })

    describe('PATCH /api/v1/admin/withdrawals/:id/complete', () => {
      let approvedWithdrawal

      beforeEach(async () => {
        approvedWithdrawal = await WithdrawalRequest.create({
          shop: shop._id,
          wallet: wallet._id,
          requestedBy: shopOwner._id,
          amount: 30000,
          bankInfo: BANK_INFO,
          status: 'approved',
        })
      })

      it('admin completes an approved withdrawal and creates DEBIT transaction', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${approvedWithdrawal._id}/complete`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ 
            adminNote: 'Transferred via bank',
            transferProof: {
              transactionId: 'TXN123456',
              transferDate: new Date(),
              bankTransferRef: 'REF789',
              note: 'Completed successfully'
            }
          })

        expect(res.statusCode).toBe(200)
        expect(res.body.data.status).toBe('completed')
        expect(res.body.data.adminNote).toBe('Transferred via bank')
        expect(res.body.data.completedBy).toBeDefined()
        expect(res.body.data.transferProof).toBeDefined()
        expect(res.body.data.transferProof.transactionId).toBe('TXN123456')

        const tx = await WalletTransaction.findOne({ shop: shop._id, type: 'debit' })
        expect(tx).not.toBeNull()
        expect(tx.netAmount).toBe(30000)

        const updatedWallet = await Wallet.findById(wallet._id)
        expect(updatedWallet.totalWithdrawn).toBe(30000)
      })

      it('admin can complete withdrawal without transferProof (optional)', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${approvedWithdrawal._id}/complete`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ adminNote: 'Transferred manually' })

        expect(res.statusCode).toBe(200)
        expect(res.body.data.status).toBe('completed')
        expect(res.body.data.completedBy).toBeDefined()
      })

      it('returns 400 when withdrawal is not in approved status (still pending)', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${withdrawal._id}/complete`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})

        expect(res.statusCode).toBe(400)
      })

      it('non-admin cannot complete withdrawal', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${approvedWithdrawal._id}/complete`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({})

        expect(res.statusCode).toBe(403)
      })

      it('validates transferProof fields when provided', async () => {
        const res = await request(app)
          .patch(`/api/v1/admin/withdrawals/${approvedWithdrawal._id}/complete`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            transferProof: {
              transactionId: 'a'.repeat(101), // Exceeds max length
            }
          })

        expect(res.statusCode).toBe(422)
        expect(res.body.success).toBe(false)
      })
    })

  })
})
