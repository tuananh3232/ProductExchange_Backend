import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { loginAdmin, loginMember } from '../setup/auth.js'
import { createSampleCategory, createSampleProduct, createSampleShop } from '../setup/factories.js'
import { SHOP_STATUS } from '../../src/constants/status.constant.js'

const api = env.apiPrefix

beforeEach(async () => {
  await resetTestDatabase()
})

describe('admin stats integration', () => {
  it('allows an admin to fetch users', async () => {
    const { token } = await loginAdmin()

    const response = await request(app)
      .get(`${api}/admin/users`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data.users)).toBe(true)
  })

  it('returns 401 for admin APIs without a token', async () => {
    const response = await request(app).get(`${api}/admin/users`)

    expect(response.status).toBe(401)
    expect(response.body.success).toBe(false)
  })

  it('returns 403 when a member calls an admin API', async () => {
    const { token } = await loginMember()

    const response = await request(app)
      .get(`${api}/admin/users`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.success).toBe(false)
  })

  it('allows an admin to list products and shops created by the test', async () => {
    const { token } = await loginAdmin()
    const shop = await createSampleShop({ status: SHOP_STATUS.PENDING_REVIEW })
    await createSampleProduct({ shop: shop._id, owner: shop.owner })

    const productsResponse = await request(app)
      .get(`${api}/admin/products`)
      .set('Authorization', `Bearer ${token}`)

    const shopsResponse = await request(app)
      .get(`${api}/admin/shops`)
      .set('Authorization', `Bearer ${token}`)

    expect(productsResponse.status).toBe(200)
    expect(Array.isArray(productsResponse.body.data.products)).toBe(true)
    expect(productsResponse.body.data.products.some((product) => product.shop?.toString?.() === shop._id.toString() || product.shop?._id?.toString() === shop._id.toString())).toBe(true)

    expect(shopsResponse.status).toBe(200)
    expect(Array.isArray(shopsResponse.body.data.shops)).toBe(true)
    expect(shopsResponse.body.data.shops.some((listedShop) => listedShop._id.toString() === shop._id.toString())).toBe(true)
  })

  it('allows an admin to list public categories when the endpoint exists', async () => {
    const { token } = await loginAdmin()
    const category = await createSampleCategory()

    const response = await request(app)
      .get(`${api}/categories`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(JSON.stringify(response.body.data)).toContain(category._id.toString())
  })

  it('allows an admin to view overview stats without relying on main DB data', async () => {
    const { token } = await loginAdmin()
    await createSampleCategory()
    await createSampleShop({ status: SHOP_STATUS.ACTIVE })

    const response = await request(app)
      .get(`${api}/admin/stats/overview`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data).toBeDefined()
  })
})
