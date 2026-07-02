import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createTestUser, loginAdmin, loginMember, loginSeller } from '../setup/auth.js'
import { createSampleOrder, createSampleProduct, createSampleShop } from '../setup/factories.js'
import { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import User from '../../src/models/user.model.js'
import UserWallet from '../../src/models/user-wallet.model.js'
import UserWalletWithdrawal from '../../src/models/user-wallet-withdrawal.model.js'
import { WITHDRAWAL_STATUS } from '../../src/constants/status.constant.js'

const api = env.apiPrefix

beforeEach(async () => {
  await resetTestDatabase()
  delete process.env.ALLOW_RBAC_RESET
})

describe('admin phase 1 security', () => {
  it('returns 400 for invalid ObjectId on admin path params', async () => {
    const { token } = await loginAdmin()

    const response = await request(app)
      .patch(`${api}/admin/users/not-an-object-id/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Invalid id test' })

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('returns 400 for invalid admin query sortBy', async () => {
    const { token } = await loginAdmin()

    const response = await request(app)
      .get(`${api}/admin/users`)
      .query({ sortBy: 'password' })
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
  })

  it('prevents self-ban and stores ban reason for target users', async () => {
    const { user: admin, token } = await loginAdmin()
    const target = await createTestUser()

    const selfBan = await request(app)
      .patch(`${api}/admin/users/${admin._id}/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'self ban should fail' })

    expect(selfBan.status).toBe(400)

    const response = await request(app)
      .patch(`${api}/admin/users/${target._id}/ban`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Policy abuse' })

    const updated = await User.findById(target._id)

    expect(response.status).toBe(200)
    expect(updated.isActive).toBe(false)
    expect(updated.banReason).toBe('Policy abuse')
    expect(updated.bannedBy.toString()).toBe(admin._id.toString())
  })

  it('does not leak KYC PII or auth tokens in admin lists', async () => {
    const { token } = await loginAdmin()
    await createTestUser({
      refreshToken: 'secret-refresh-token',
      emailVerificationToken: 'secret-email-token',
      resetPasswordToken: 'secret-reset-token',
      kyc: {
        status: 'pending',
        fullName: 'Sensitive User',
        idNumber: '123456789012',
        frontImage: { url: 'https://example.com/front.png', publicId: 'front-id' },
        backImage: { url: 'https://example.com/back.png', publicId: 'back-id' },
        submittedAt: new Date(),
      },
    })

    const usersResponse = await request(app)
      .get(`${api}/admin/users`)
      .set('Authorization', `Bearer ${token}`)

    const kycResponse = await request(app)
      .get(`${api}/admin/kyc`)
      .set('Authorization', `Bearer ${token}`)

    const listedUser = usersResponse.body.data.users.find((user) => user.kyc?.fullName === 'Sensitive User')
    const listedKyc = kycResponse.body.data.kycs.find((item) => item.kyc?.fullName === 'Sensitive User')

    expect(usersResponse.status).toBe(200)
    expect(listedUser.password).toBeUndefined()
    expect(listedUser.refreshToken).toBeUndefined()
    expect(listedUser.emailVerificationToken).toBeUndefined()
    expect(listedUser.resetPasswordToken).toBeUndefined()
    expect(listedUser.kyc.idNumber).toBe('********9012')
    expect(listedUser.kyc.frontImage).toBeUndefined()
    expect(listedUser.kyc.backImage).toBeUndefined()

    expect(kycResponse.status).toBe(200)
    expect(listedKyc.kyc.idNumber).toBe('********9012')
    expect(listedKyc.kyc.frontImage).toBeUndefined()
    expect(listedKyc.kyc.backImage).toBeUndefined()
  })

  it('masks bank account numbers in admin withdrawal lists', async () => {
    const { user } = await loginMember()
    const { token } = await loginAdmin()
    const wallet = await UserWallet.create({ user: user._id, balance: 100000, pendingBalance: 50000 })
    await UserWalletWithdrawal.create({
      user: user._id,
      wallet: wallet._id,
      amount: 50000,
      bankInfo: {
        bankName: 'Test Bank',
        accountNumber: '123456789',
        accountName: 'TEST USER',
      },
      status: WITHDRAWAL_STATUS.PENDING,
    })

    const response = await request(app)
      .get(`${api}/admin/user-withdrawals`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data[0].bankInfo.accountNumber).toBe('*****6789')
  })

  it('keeps order list filters inside non-admin authorization scope', async () => {
    const { user: buyerA, token: buyerAToken } = await loginMember()
    const buyerB = await createTestUser()
    const shop = await createSampleShop()
    await createSampleOrder({ buyer: buyerB._id, shop: shop._id, seller: null })

    const listResponse = await request(app)
      .get(`${api}/orders`)
      .query({ shopId: shop._id.toString() })
      .set('Authorization', `Bearer ${buyerAToken}`)

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data.orders).toHaveLength(0)

    const ownOrder = await createSampleOrder({ buyer: buyerA._id, shop: shop._id, seller: null })
    const detailResponse = await request(app)
      .get(`${api}/orders/${ownOrder._id}`)
      .set('Authorization', `Bearer ${buyerAToken}`)

    expect(detailResponse.status).toBe(200)
  })

  it('prevents one seller from expanding order scope to another seller', async () => {
    const { token: sellerAToken } = await loginSeller()
    const sellerB = await createTestUser({ roles: ['seller'] })
    const product = await createSampleProduct({
      owner: sellerB._id,
      seller: sellerB._id,
      shop: null,
      ownerType: PRODUCT_OWNER_TYPES.SELLER,
    })
    await createSampleOrder({ seller: sellerB._id, shop: null, product, buyer: (await createTestUser())._id })

    const response = await request(app)
      .get(`${api}/orders`)
      .query({ scope: 'seller', sellerId: sellerB._id.toString() })
      .set('Authorization', `Bearer ${sellerAToken}`)

    expect(response.status).toBe(200)
    expect(response.body.data.orders).toHaveLength(0)
  })

  it('still allows admin to use global order filters', async () => {
    const { token } = await loginAdmin()
    const shop = await createSampleShop()
    const order = await createSampleOrder({ shop: shop._id, seller: null })

    const response = await request(app)
      .get(`${api}/orders`)
      .query({ shopId: shop._id.toString() })
      .set('Authorization', `Bearer ${token}`)

    const orderIds = response.body.data.orders.map((item) => item._id.toString())

    expect(response.status).toBe(200)
    expect(orderIds).toContain(order._id.toString())
  })

  it('blocks RBAC seed HTTP endpoint without explicit env guard', async () => {
    const { token } = await loginAdmin()

    const response = await request(app)
      .post(`${api}/admin/rbac/seed`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
  })
})
