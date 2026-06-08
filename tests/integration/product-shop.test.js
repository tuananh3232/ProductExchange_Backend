import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { ROLES } from '../../src/constants/role.constant.js'
import { PRODUCT_STATUS, SHOP_STATUS } from '../../src/constants/status.constant.js'
import { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { ensureRbacSeedData } from '../../src/services/rbac/rbac-seed.service.js'
import { createAndLogin, loginAdmin, loginMember, loginSeller, loginShopOwner } from '../setup/auth.js'
import { createSampleCategory, createSampleProduct, createSampleShop } from '../setup/factories.js'

const api = env.apiPrefix

const productPayload = (overrides = {}) => ({
  title: `Decor Product ${Date.now()}`,
  description: 'A reusable integration test product with enough description.',
  price: 150000,
  stock: 3,
  listingType: 'sell',
  condition: 'new',
  location: { province: 'Test Province', district: 'Test District' },
  ...overrides,
})

beforeEach(async () => {
  await resetTestDatabase()
  await ensureRbacSeedData()
})

describe('product and shop integration', () => {
  it('allows a shop owner to create a shop draft', async () => {
    const { token } = await loginShopOwner()

    const response = await request(app)
      .post(`${api}/shops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Draft Shop ${Date.now()}`,
        description: 'Integration draft shop',
        phone: '0900000000',
        email: 'draft-shop@example.com',
        address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' },
      })

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.DRAFT)
  })

  it('allows a shop owner to submit a complete shop for review', async () => {
    const { user, token } = await createAndLogin(ROLES.SHOP_OWNER, {
      kyc: { status: 'pending', fullName: 'Shop Owner', idNumber: '123456789012' },
    })
    const shop = await createSampleShop({
      owner: user._id,
      status: SHOP_STATUS.DRAFT,
      phone: '0900000000',
      email: 'submit-shop@example.com',
      address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' },
    })

    const response = await request(app)
      .post(`${api}/shops/${shop._id}/submit`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.PENDING_REVIEW)
  })

  it('allows an admin to approve a pending shop when owner KYC is approved', async () => {
    const { user: owner } = await createAndLogin(ROLES.SHOP_OWNER, {
      kyc: { status: 'approved', fullName: 'Approved Owner', idNumber: '123456789013' },
    })
    const { token: adminToken } = await loginAdmin()
    const shop = await createSampleShop({
      owner: owner._id,
      status: SHOP_STATUS.PENDING_REVIEW,
      phone: '0900000000',
      email: 'approve-shop@example.com',
      address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' },
    })

    const response = await request(app)
      .patch(`${api}/admin/shops/${shop._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.ACTIVE)
  })

  it('allows a shop owner to create a product for their active shop', async () => {
    const { user, token } = await loginShopOwner()
    const category = await createSampleCategory()
    const shop = await createSampleShop({ owner: user._id, status: SHOP_STATUS.ACTIVE })

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload({ ownerType: PRODUCT_OWNER_TYPES.SHOP, shop: shop._id.toString(), category: category._id.toString() }))

    expect(response.status).toBe(201)
    expect(response.body.data.product.shop.toString()).toBe(shop._id.toString())
    expect(response.body.data.product.ownerType).toBe(PRODUCT_OWNER_TYPES.SHOP)
  })

  it('allows a seller to create a personal product', async () => {
    const { token } = await loginSeller()
    const category = await createSampleCategory()

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload({ ownerType: PRODUCT_OWNER_TYPES.SELLER, category: category._id.toString() }))

    expect(response.status).toBe(201)
    expect(response.body.data.product.ownerType).toBe(PRODUCT_OWNER_TYPES.SELLER)
    expect(response.body.data.product.seller).toBeDefined()
  })

  it('does not allow a member to create a product', async () => {
    const { token } = await loginMember()
    const category = await createSampleCategory()

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload({ ownerType: PRODUCT_OWNER_TYPES.SELLER, category: category._id.toString() }))

    expect(response.status).toBe(403)
  })

  it('only returns active available products in the public list by default', async () => {
    const availableProduct = await createSampleProduct({ status: PRODUCT_STATUS.AVAILABLE, isActive: true })
    const hiddenProduct = await createSampleProduct({ status: PRODUCT_STATUS.HIDDEN, isActive: true })
    const inactiveProduct = await createSampleProduct({ status: PRODUCT_STATUS.AVAILABLE, isActive: false })

    const response = await request(app).get(`${api}/products`)

    const ids = response.body.data.products.map((product) => product._id.toString())
    expect(response.status).toBe(200)
    expect(ids).toContain(availableProduct._id.toString())
    expect(ids).not.toContain(hiddenProduct._id.toString())
    expect(ids).not.toContain(inactiveProduct._id.toString())
  })

  it('does not allow a different seller to manage someone else product', async () => {
    const { user: owner } = await loginSeller()
    const { token: otherSellerToken } = await loginSeller()
    const product = await createSampleProduct({
      ownerType: PRODUCT_OWNER_TYPES.SELLER,
      owner: owner._id,
      seller: owner._id,
      shop: null,
    })

    const response = await request(app)
      .patch(`${api}/products/${product._id}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .send({ title: 'Updated by other seller' })

    expect(response.status).toBe(403)
  })
})
