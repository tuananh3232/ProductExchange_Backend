import request from 'supertest'
import fs from 'fs'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import ERRORS from '../../src/constants/error.constant.js'
import { ROLES } from '../../src/constants/role.constant.js'
import { PRODUCT_STATUS, SHOP_STATUS } from '../../src/constants/status.constant.js'
import { PRODUCT_OWNER_TYPES } from '../../src/models/product.model.js'
import PERMISSIONS from '../../src/constants/permission.constant.js'
import Shop from '../../src/models/shop.model.js'
import User from '../../src/models/user.model.js'
import { resetTestDatabase } from '../setup/test-db.js'
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
  ...overrides
})

beforeEach(async () => {
  await resetTestDatabase()
})

describe('product and shop integration', () => {
  it('does not allow a member without approved KYC to create a shop draft', async () => {
    const { token } = await loginMember()

    const response = await request(app)
      .post(`${api}/shops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Blocked Draft Shop ${Date.now()}`,
        description: 'Integration draft shop'
      })

    expect(response.status).toBe(403)
    expect(response.body.message).toBe('Bạn cần được duyệt KYC trước khi tạo shop')
    expect(response.body.error).toBe('KYC_APPROVAL_REQUIRED')
  })

  it('allows an approved seller to create a shop draft without granting shop_owner role', async () => {
    const { user, token } = await loginSeller({
      kyc: { status: 'approved', fullName: 'Approved Seller', idNumber: '123456789012' }
    })

    const response = await request(app)
      .post(`${api}/shops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Draft Shop ${Date.now()}`,
        description: 'Integration draft shop',
        phone: '0900000000',
        email: 'draft-shop@example.com',
        address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' }
      })

    const owner = await User.findById(user._id).select('roles')

    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.DRAFT)
    expect(response.body.data.shop.owner._id || response.body.data.shop.owner).toBe(user._id.toString())
    expect(owner.roles).toContain(ROLES.SELLER)
    expect(owner.roles).not.toContain(ROLES.SHOP_OWNER)
  })

  it('allows a KYC-approved seller to create a draft shop and list it from my shops', async () => {
    const { user, token } = await createAndLogin(ROLES.MEMBER, {
      roles: [ROLES.MEMBER, ROLES.SELLER],
      kyc: { status: 'approved', fullName: 'Approved Seller', idNumber: '123456789015' }
    })

    const createResponse = await request(app)
      .post(`${api}/shops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Mine Draft Shop ${Date.now()}`,
        description: 'Integration draft shop',
        phone: '0900000001',
        email: 'mine-draft-shop@example.com',
        address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' }
      })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.data.shop.status).toBe(SHOP_STATUS.DRAFT)

    const mineResponse = await request(app).get(`${api}/shops/mine`).set('Authorization', `Bearer ${token}`)
    const shopIds = mineResponse.body.data.shops.map((shop) => shop._id.toString())
    const owner = await User.findById(user._id).select('roles')

    expect(mineResponse.status).toBe(200)
    expect(shopIds).toContain(createResponse.body.data.shop._id.toString())
    expect(owner.roles).toContain(ROLES.SELLER)
    expect(owner.roles).not.toContain(ROLES.SHOP_OWNER)
  })

  it('does not include another seller draft shop in my shops', async () => {
    const { user: ownerA } = await loginSeller({
      kyc: { status: 'approved', fullName: 'Owner A', idNumber: '123456789016' }
    })
    const { token: ownerBToken } = await loginSeller({
      kyc: { status: 'approved', fullName: 'Owner B', idNumber: '123456789017' }
    })
    const shop = await createSampleShop({ owner: ownerA._id, status: SHOP_STATUS.DRAFT })

    const response = await request(app).get(`${api}/shops/mine`).set('Authorization', `Bearer ${ownerBToken}`)
    const shopIds = response.body.data.shops.map((item) => item._id.toString())

    expect(response.status).toBe(200)
    expect(shopIds).not.toContain(shop._id.toString())
  })

  it('does not expose draft shops through public shop detail', async () => {
    const shop = await createSampleShop({ status: SHOP_STATUS.DRAFT })

    const response = await request(app).get(`${api}/shops/${shop._id}`)

    expect(response.status).toBe(404)
  })

  it('allows a KYC-approved user with a stale non-seller token to create a shop draft', async () => {
    const { token } = await loginMember({
      kyc: { status: 'approved', fullName: 'Approved Member', idNumber: '123456789014' }
    })

    const response = await request(app)
      .post(`${api}/shops`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Approved KYC Draft Shop ${Date.now()}`,
        description: 'Integration draft shop'
      })

    expect(response.status).toBe(201)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.DRAFT)
  })

  it('allows a shop owner to submit a complete shop for review', async () => {
    const { user, token } = await createAndLogin(ROLES.SHOP_OWNER, {
      kyc: { status: 'pending', fullName: 'Shop Owner', idNumber: '123456789012' }
    })
    const shop = await createSampleShop({
      owner: user._id,
      status: SHOP_STATUS.DRAFT,
      phone: '0900000000',
      email: 'submit-shop@example.com',
      address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' }
    })

    const response = await request(app).post(`${api}/shops/${shop._id}/submit`).set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.PENDING_REVIEW)
  })

  it('does not allow submitting a shop with incomplete onboarding information', async () => {
    const { user, token } = await loginSeller({
      kyc: { status: 'approved', fullName: 'Submit Seller', idNumber: '123456789018' }
    })
    const shop = await createSampleShop({
      owner: user._id,
      status: SHOP_STATUS.DRAFT,
      phone: '',
      email: '',
      address: { province: '', district: '', detail: '' }
    })

    const response = await request(app).post(`${api}/shops/${shop._id}/submit`).set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe(ERRORS.SHOP.INCOMPLETE_ONBOARDING)
  })

  it('allows a seller owner to submit a complete draft shop for review', async () => {
    const { user, token } = await loginSeller({
      kyc: { status: 'approved', fullName: 'Complete Submit Seller', idNumber: '123456789019' }
    })
    const shop = await createSampleShop({
      owner: user._id,
      status: SHOP_STATUS.DRAFT,
      phone: '0900000002',
      email: 'complete-submit-shop@example.com',
      address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' }
    })

    const response = await request(app).post(`${api}/shops/${shop._id}/submit`).set('Authorization', `Bearer ${token}`)
    const owner = await User.findById(user._id).select('roles')

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.PENDING_REVIEW)
    expect(owner.roles).toContain(ROLES.SELLER)
    expect(owner.roles).not.toContain(ROLES.SHOP_OWNER)
  })

  it('uses the shop profile submit-review permission in submitForReview', () => {
    const serviceSource = fs.readFileSync('src/services/shop/shop.service.js', 'utf8')
    const submitForReviewSource = serviceSource.slice(
      serviceSource.indexOf('export const submitForReview'),
      serviceSource.indexOf('export const updateShop')
    )

    expect(submitForReviewSource).toContain('PERMISSIONS.SHOP_PROFILE_SUBMIT_REVIEW')
    expect(submitForReviewSource).not.toContain('PERMISSIONS.SHOP_STAFF_PERMISSION_READ')
  })

  it('allows an admin to approve a pending shop when owner KYC is approved', async () => {
    const { user: owner } = await createAndLogin(ROLES.SELLER, {
      kyc: { status: 'approved', fullName: 'Approved Owner', idNumber: '123456789013' }
    })
    const { token: adminToken } = await loginAdmin()
    const shop = await createSampleShop({
      owner: owner._id,
      status: SHOP_STATUS.PENDING_REVIEW,
      phone: '0900000000',
      email: 'approve-shop@example.com',
      address: { province: 'Test Province', district: 'Test District', detail: 'Test Address' }
    })

    const response = await request(app)
      .patch(`${api}/admin/shops/${shop._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.ACTIVE)

    const approvedOwner = await User.findById(owner._id).select('roles')
    expect(approvedOwner.roles).toContain(ROLES.SELLER)
    expect(approvedOwner.roles).toContain(ROLES.SHOP_OWNER)
  })

  it('allows a shop owner to create a product for their active shop', async () => {
    const { user, token } = await loginShopOwner()
    const category = await createSampleCategory()
    const shop = await createSampleShop({ owner: user._id, status: SHOP_STATUS.ACTIVE })

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send(
        productPayload({
          ownerType: PRODUCT_OWNER_TYPES.SHOP,
          shop: shop._id.toString(),
          category: category._id.toString()
        })
      )

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
      shop: null
    })

    const response = await request(app)
      .patch(`${api}/products/${product._id}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .send({ title: 'Updated by other seller' })

    expect(response.status).toBe(403)
  })

  it('allows shop staff with shop:product:create to create a product for the assigned shop', async () => {
    const { user: owner } = await loginShopOwner()
    const { user: staff, token: staffToken } = await createAndLogin(ROLES.STAFF)
    const category = await createSampleCategory()
    const shop = await createSampleShop({ owner: owner._id, status: SHOP_STATUS.ACTIVE })
    await Shop.findByIdAndUpdate(shop._id, {
      $push: {
        staff: staff._id,
        staffPermissions: { staffUser: staff._id, permissions: [PERMISSIONS.SHOP_PRODUCT_CREATE] }
      }
    })

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(
        productPayload({
          ownerType: PRODUCT_OWNER_TYPES.SHOP,
          shop: shop._id.toString(),
          category: category._id.toString()
        })
      )

    expect(response.status).toBe(201)
    expect(response.body.data.product.shop.toString()).toBe(shop._id.toString())
  })

  it('blocks shop staff without shop:product:create from creating a shop product', async () => {
    const { user: owner } = await loginShopOwner()
    const { user: staff, token: staffToken } = await createAndLogin(ROLES.STAFF)
    const category = await createSampleCategory()
    const shop = await createSampleShop({ owner: owner._id, status: SHOP_STATUS.ACTIVE })
    await Shop.findByIdAndUpdate(shop._id, {
      $push: {
        staff: staff._id,
        staffPermissions: { staffUser: staff._id, permissions: [] }
      }
    })

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(
        productPayload({
          ownerType: PRODUCT_OWNER_TYPES.SHOP,
          shop: shop._id.toString(),
          category: category._id.toString()
        })
      )

    expect(response.status).toBe(403)
  })

  it('does not allow shop staff to reuse permissions from another shop', async () => {
    const { user: ownerA } = await loginShopOwner()
    const { user: ownerB } = await loginShopOwner()
    const { user: staff, token: staffToken } = await createAndLogin(ROLES.STAFF)
    const category = await createSampleCategory()
    const shopA = await createSampleShop({ owner: ownerA._id, status: SHOP_STATUS.ACTIVE })
    const shopB = await createSampleShop({ owner: ownerB._id, status: SHOP_STATUS.ACTIVE })
    await Shop.findByIdAndUpdate(shopA._id, {
      $push: {
        staff: staff._id,
        staffPermissions: { staffUser: staff._id, permissions: [PERMISSIONS.SHOP_PRODUCT_CREATE] }
      }
    })

    const response = await request(app)
      .post(`${api}/products`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(
        productPayload({
          ownerType: PRODUCT_OWNER_TYPES.SHOP,
          shop: shopB._id.toString(),
          category: category._id.toString()
        })
      )

    expect(response.status).toBe(403)
  })

  it('rejects assigning non-shop-staff permissions to shop staff', async () => {
    const { user: owner, token: ownerToken } = await loginShopOwner()
    const { user: staff } = await createAndLogin(ROLES.STAFF)
    const shop = await createSampleShop({ owner: owner._id, status: SHOP_STATUS.ACTIVE, staff: [staff._id] })

    const response = await request(app)
      .put(`${api}/shops/${shop._id}/staff/${staff._id}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissions: [PERMISSIONS.SELLER_PRODUCT_CREATE] })

    expect(response.status).toBe(422)
  })
})
