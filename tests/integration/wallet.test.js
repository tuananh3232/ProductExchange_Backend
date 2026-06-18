import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginAdmin, loginMember, loginShopOwner } from '../setup/auth.js'
import { createSampleShop } from '../setup/factories.js'
import Wallet from '../../src/models/wallet.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletWithdrawal from '../../src/models/user-wallet-withdrawal.model.js'
import { WITHDRAWAL_STATUS } from '../../src/constants/status.constant.js'

const api = env.apiPrefix

const bankInfo = {
  bankName: 'Test Bank',
  accountNumber: '123456789',
  accountName: 'TEST USER',
}

beforeEach(async () => {
  await resetTestDatabase()
})

describe('wallet integration', () => {
  it('allows a member to view their personal wallet', async () => {
    const { user, token } = await loginMember()
    await UserWallet.create({ user: user._id, balance: 250000, totalTopUp: 300000 })

    const response = await request(app)
      .get(`${api}/user-wallet/me`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.user.toString()).toBe(user._id.toString())
    expect(response.body.data.balance).toBe(250000)
  })

  it('allows a shop owner to view their shop wallet', async () => {
    const { user, token } = await loginShopOwner()
    const shop = await createSampleShop({ owner: user._id })
    await Wallet.create({ shop: shop._id, balance: 500000 })

    const response = await request(app)
      .get(`${api}/wallet/shops/${shop._id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect((response.body.data.shop._id || response.body.data.shop).toString()).toBe(shop._id.toString())
    expect(response.body.data.balance).toBe(500000)
  })

  it('creates a user wallet withdrawal from test-created balance', async () => {
    const { user, token } = await loginMember()
    await UserWallet.create({ user: user._id, balance: 200000 })

    const response = await request(app)
      .post(`${api}/user-wallet/me/withdrawals`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 50000, bankInfo, note: 'Integration withdrawal' })

    const wallet = await UserWallet.findOne({ user: user._id })

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe(WITHDRAWAL_STATUS.PENDING)
    expect(wallet.balance).toBe(150000)
    expect(wallet.pendingBalance).toBe(50000)
  })

  it('lets an admin approve a user withdrawal', async () => {
    const { user } = await loginMember()
    const { token: adminToken } = await loginAdmin()
    const wallet = await UserWallet.create({ user: user._id, balance: 150000, pendingBalance: 50000 })
    const withdrawal = await UserWalletWithdrawal.create({
      user: user._id,
      wallet: wallet._id,
      amount: 50000,
      bankInfo,
      status: WITHDRAWAL_STATUS.PENDING,
    })

    const response = await request(app)
      .patch(`${api}/admin/user-withdrawals/${withdrawal._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe(WITHDRAWAL_STATUS.APPROVED)
    expect(response.body.data.approvedBy.toString()).toBeDefined()
  })

  it('lets an admin reject a user withdrawal and restore pending balance', async () => {
    const { user } = await loginMember()
    const { token: adminToken } = await loginAdmin()
    const wallet = await UserWallet.create({ user: user._id, balance: 150000, pendingBalance: 50000 })
    const withdrawal = await UserWalletWithdrawal.create({
      user: user._id,
      wallet: wallet._id,
      amount: 50000,
      bankInfo,
      status: WITHDRAWAL_STATUS.PENDING,
    })

    const response = await request(app)
      .patch(`${api}/admin/user-withdrawals/${withdrawal._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'Invalid bank info', adminNote: 'Rejected by test' })

    const restoredWallet = await UserWallet.findById(wallet._id)

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe(WITHDRAWAL_STATUS.REJECTED)
    expect(restoredWallet.balance).toBe(200000)
    expect(restoredWallet.pendingBalance).toBe(0)
  })
})
