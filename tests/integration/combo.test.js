import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createSampleProduct } from '../setup/factories.js'

const api = env.apiPrefix

const createComboProduct = (overrides = {}) =>
  createSampleProduct({
    price: 300000,
    stock: 10,
    decorRole: 'main_item',
    style: 'minimalist',
    roomType: 'living_room',
    colorTone: 'neutral',
    comboPriority: 3,
    ...overrides,
  })

beforeEach(async () => {
  await resetTestDatabase()
})

describe('POST /combos/generate', () => {
  it('returns 3 combo tiers (Basic/Standard/Premium) each within budget', async () => {
    await Promise.all([
      createComboProduct({ decorRole: 'main_item', price: 500000 }),
      createComboProduct({ decorRole: 'lighting', price: 200000 }),
      createComboProduct({ decorRole: 'wall_decor', price: 150000 }),
      createComboProduct({ decorRole: 'accent_item', price: 100000 }),
    ])

    const res = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1500000, style: 'minimalist', roomType: 'living_room', colorTone: 'neutral' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.combos).toHaveLength(3)
    const types = res.body.data.combos.map((c) => c.comboType)
    expect(types).toContain('Basic')
    expect(types).toContain('Standard')
    expect(types).toContain('Premium')
    for (const combo of res.body.data.combos) {
      expect(combo.totalPrice).toBeLessThanOrEqual(combo.targetBudget)
      expect(combo.products.length).toBeGreaterThan(0)
    }
  })

  it('excludes inactive and out-of-stock products from combos', async () => {
    await Promise.all([
      createComboProduct({ title: 'Active main', decorRole: 'main_item', price: 300000 }),
      createComboProduct({ title: 'Inactive lighting', decorRole: 'lighting', price: 100000, isActive: false }),
      createComboProduct({ title: 'OOS lighting', decorRole: 'lighting', price: 100000, stock: 0 }),
      createComboProduct({ title: 'Active wall', decorRole: 'wall_decor', price: 200000 }),
    ])

    const res = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000000 })

    expect(res.status).toBe(200)
    for (const combo of res.body.data.combos) {
      const titles = combo.products.map((p) => p.title)
      expect(titles).not.toContain('Inactive lighting')
      expect(titles).not.toContain('OOS lighting')
    }
  })

  it('returns empty combos when no products match the criteria', async () => {
    await createComboProduct({ style: 'modern', roomType: 'workspace' })

    const res = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000000, style: 'vintage', roomType: 'kitchen' })

    expect(res.status).toBe(200)
    expect(res.body.data.combos).toEqual([])
  })

  it('returns empty combos when budget is too low for any product', async () => {
    await createComboProduct({ price: 900000, decorRole: 'main_item' })

    const res = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000 })

    expect(res.status).toBe(200)
    expect(res.body.data.combos).toEqual([])
  })

  it('returns deterministic results for the same seed', async () => {
    await Promise.all([
      createComboProduct({ decorRole: 'main_item', price: 400000 }),
      createComboProduct({ decorRole: 'lighting', price: 200000 }),
      createComboProduct({ decorRole: 'wall_decor', price: 150000 }),
    ])

    const payload = { budget: 1000000, seed: 'stabletest1' }
    const res1 = await request(app).post(`${api}/combos/generate`).send(payload)
    const res2 = await request(app).post(`${api}/combos/generate`).send(payload)

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res1.body.data.combos.map((c) => c.totalPrice)).toEqual(
      res2.body.data.combos.map((c) => c.totalPrice)
    )
    expect(res1.body.meta.seed).toBe(res2.body.meta.seed)
  })

  it('paginates combos across pages using seed', async () => {
    await Promise.all([
      createComboProduct({ decorRole: 'main_item', price: 200000 }),
      createComboProduct({ decorRole: 'lighting', price: 150000 }),
      createComboProduct({ decorRole: 'wall_decor', price: 100000 }),
      createComboProduct({ decorRole: 'accent_item', price: 80000 }),
    ])

    const seed = 'paginationtest'
    const page1 = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000000, seed, page: 1, pageSize: 2 })
    const page2 = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000000, seed, page: 2, pageSize: 2 })

    expect(page1.status).toBe(200)
    expect(page1.body.data.combos).toHaveLength(2)
    expect(page1.body.meta.hasMore).toBe(true)
    expect(page2.status).toBe(200)
    expect(page2.body.data.combos.length).toBeGreaterThanOrEqual(1)
  })

  it('marks products with stock <= 5 as low_stock', async () => {
    await Promise.all([
      createComboProduct({ decorRole: 'main_item', price: 300000, stock: 3 }),
      createComboProduct({ decorRole: 'lighting', price: 200000, stock: 5 }),
    ])

    const res = await request(app)
      .post(`${api}/combos/generate`)
      .send({ budget: 1000000 })

    expect(res.status).toBe(200)
    const allProducts = res.body.data.combos.flatMap((c) => c.products)
    expect(allProducts.some((p) => p.availabilityStatus === 'low_stock')).toBe(true)
    expect(allProducts.some((p) => p.availabilityStatus === 'available')).toBe(false)
  })

  it.each([
    [{ budget: 500 }, 'budget'],
    [{ budget: 1000000, maxItems: 1 }, 'maxItems'],
    [{ budget: 1000000, maxItems: 11 }, 'maxItems'],
    [{ budget: 1000000, style: 'industrial' }, 'style'],
    [{ budget: 1000000, roomType: 'garage' }, 'roomType'],
    [{ budget: 1000000, colorTone: 'rainbow' }, 'colorTone'],
    [{}, 'budget'],
  ])('returns 422 for invalid payload %o (field: %s)', async (payload, field) => {
    const res = await request(app).post(`${api}/combos/generate`).send(payload)
    expect(res.status).toBe(422)
    expect(res.body.details.some((d) => d.field === field)).toBe(true)
  })
})

describe('GET /combos/alternatives', () => {
  it('returns products of the requested decorRole sorted by score descending', async () => {
    await Promise.all([
      createComboProduct({ title: 'High score', decorRole: 'lighting', comboPriority: 5 }),
      createComboProduct({ title: 'Low score', decorRole: 'lighting', comboPriority: 1 }),
      createComboProduct({ title: 'Wrong role', decorRole: 'main_item' }),
    ])

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', style: 'minimalist', roomType: 'living_room', colorTone: 'neutral' })

    expect(res.status).toBe(200)
    const titles = res.body.data.alternatives.map((p) => p.title)
    expect(titles).toContain('High score')
    expect(titles).toContain('Low score')
    expect(titles).not.toContain('Wrong role')
    expect(titles.indexOf('High score')).toBeLessThan(titles.indexOf('Low score'))
  })

  it('applies maxPrice filter', async () => {
    await Promise.all([
      createComboProduct({ title: 'Affordable', decorRole: 'lighting', price: 200000 }),
      createComboProduct({ title: 'Expensive', decorRole: 'lighting', price: 800000 }),
    ])

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', maxPrice: 500000 })

    expect(res.status).toBe(200)
    const titles = res.body.data.alternatives.map((p) => p.title)
    expect(titles).toContain('Affordable')
    expect(titles).not.toContain('Expensive')
  })

  it('prioritizes strict style, roomType, and colorTone matches before fallback results', async () => {
    await Promise.all([
      createComboProduct({
        title: 'Strict match',
        decorRole: 'lighting',
        style: 'minimalist',
        roomType: 'living_room',
        colorTone: 'neutral',
        comboPriority: 1,
      }),
      createComboProduct({
        title: 'Wrong tone',
        decorRole: 'lighting',
        style: 'minimalist',
        roomType: 'living_room',
        colorTone: 'warm',
        comboPriority: 10,
      }),
      createComboProduct({
        title: 'Wrong room',
        decorRole: 'lighting',
        style: 'minimalist',
        roomType: 'bedroom',
        colorTone: 'neutral',
        comboPriority: 10,
      }),
      createComboProduct({
        title: 'Wrong style',
        decorRole: 'lighting',
        style: 'modern',
        roomType: 'living_room',
        colorTone: 'neutral',
        comboPriority: 10,
      }),
    ])

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({
        decorRole: 'lighting',
        style: 'minimalist',
        roomType: 'living_room',
        colorTone: 'neutral',
        limit: 4,
      })

    expect(res.status).toBe(200)
    expect(res.body.data.alternatives.map((p) => p.title)).toEqual([
      'Strict match',
      'Wrong tone',
      'Wrong room',
      'Wrong style',
    ])
  })

  it('excludes specified product IDs', async () => {
    const excluded = await createComboProduct({ title: 'Excluded', decorRole: 'lighting' })
    await createComboProduct({ title: 'Included', decorRole: 'lighting' })

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', excludeProductIds: excluded._id.toString() })

    expect(res.status).toBe(200)
    const ids = res.body.data.alternatives.map((p) => p._id)
    expect(ids).not.toContain(excluded._id.toString())
    expect(res.body.data.alternatives.some((p) => p.title === 'Included')).toBe(true)
  })

  it('excludes multiple IDs, ignores duplicates, invalid IDs, and blank values', async () => {
    const firstExcluded = await createComboProduct({ title: 'First excluded', decorRole: 'lighting' })
    const secondExcluded = await createComboProduct({ title: 'Second excluded', decorRole: 'lighting' })
    await createComboProduct({ title: 'Still included', decorRole: 'lighting' })

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({
        decorRole: 'lighting',
        excludeProductIds: ` ${firstExcluded._id},invalid-id,${secondExcluded._id},${firstExcluded._id}, `,
      })

    expect(res.status).toBe(200)
    const titles = res.body.data.alternatives.map((p) => p.title)
    expect(titles).not.toContain('First excluded')
    expect(titles).not.toContain('Second excluded')
    expect(titles).toContain('Still included')
  })

  it('excludes inactive and out-of-stock products', async () => {
    await Promise.all([
      createComboProduct({ title: 'Active', decorRole: 'lighting' }),
      createComboProduct({ title: 'Inactive', decorRole: 'lighting', isActive: false }),
      createComboProduct({ title: 'Out of stock', decorRole: 'lighting', stock: 0 }),
    ])

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting' })

    expect(res.status).toBe(200)
    const titles = res.body.data.alternatives.map((p) => p.title)
    expect(titles).toContain('Active')
    expect(titles).not.toContain('Inactive')
    expect(titles).not.toContain('Out of stock')
  })

  it('respects the limit parameter', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createComboProduct({ title: `Lighting ${i}`, decorRole: 'lighting' })
      )
    )

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', limit: 3 })

    expect(res.status).toBe(200)
    expect(res.body.data.alternatives).toHaveLength(3)
  })

  it('returns the single remaining product when the pool is nearly exhausted', async () => {
    await createComboProduct({ title: 'Only option left', decorRole: 'lighting' })

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting' })

    expect(res.status).toBe(200)
    expect(res.body.data.alternatives).toHaveLength(1)
    expect(res.body.data.alternatives[0].title).toBe('Only option left')
  })

  it('returns empty list when no alternatives exist', async () => {
    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'fragrance', style: 'luxury', maxPrice: 1000 })

    expect(res.status).toBe(200)
    expect(res.body.data.alternatives).toEqual([])
  })

  it('supports repeated alternative requests without backend state', async () => {
    const first = await createComboProduct({ title: 'First', decorRole: 'lighting' })
    const second = await createComboProduct({ title: 'Second', decorRole: 'lighting' })
    const third = await createComboProduct({ title: 'Third', decorRole: 'lighting' })

    const res1 = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', limit: 2 })

    const res2 = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({
        decorRole: 'lighting',
        excludeProductIds: `${first._id},${second._id}`,
        limit: 2,
      })

    const res3 = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({
        decorRole: 'lighting',
        excludeProductIds: `${first._id},${second._id},${third._id}`,
        limit: 2,
      })

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(res3.status).toBe(200)
    expect(res1.body.data.alternatives).toHaveLength(2)
    expect(res2.body.data.alternatives.map((p) => p.title)).toEqual(['Third'])
    expect(res3.body.data.alternatives).toEqual([])
  })

  it('returns the expected response format', async () => {
    await createComboProduct({ title: 'Formatted', decorRole: 'lighting' })

    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'lighting', limit: 1 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data.alternatives)).toBe(true)
    expect(res.body.data.alternatives[0]).toMatchObject({
      title: 'Formatted',
      decorRole: 'lighting',
      style: 'minimalist',
      roomType: 'living_room',
      colorTone: 'neutral',
    })
    expect(res.body.data.alternatives[0]).not.toHaveProperty('canReplace')
  })

  it('returns 422 for invalid decorRole', async () => {
    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ decorRole: 'unknown_role' })

    expect(res.status).toBe(422)
  })

  it('returns 422 when decorRole is missing', async () => {
    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query({ style: 'minimalist' })

    expect(res.status).toBe(422)
  })

  it.each([
    [{ decorRole: 'lighting', limit: 0 }, 'limit'],
    [{ decorRole: 'lighting', limit: -1 }, 'limit'],
    [{ decorRole: 'lighting', limit: 51 }, 'limit'],
    [{ decorRole: 'lighting', maxPrice: 0 }, 'maxPrice'],
    [{ decorRole: 'lighting', maxPrice: -1 }, 'maxPrice'],
    [{ decorRole: 'lighting', style: 'industrial' }, 'style'],
    [{ decorRole: 'lighting', roomType: 'garage' }, 'roomType'],
    [{ decorRole: 'lighting', colorTone: 'rainbow' }, 'colorTone'],
  ])('returns 422 for invalid alternatives query %o (field: %s)', async (query, field) => {
    const res = await request(app)
      .get(`${api}/combos/alternatives`)
      .query(query)

    expect(res.status).toBe(422)
    expect(res.body.details.some((d) => d.field === field)).toBe(true)
  })
})

describe('GET /combos/options', () => {
  it('returns all option fields with non-empty arrays', async () => {
    const res = await request(app).get(`${api}/combos/options`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const { data } = res.body
    expect(Array.isArray(data.styles)).toBe(true)
    expect(Array.isArray(data.roomTypes)).toBe(true)
    expect(Array.isArray(data.colorTones)).toBe(true)
    expect(Array.isArray(data.decorRoles)).toBe(true)
    expect(data.styles.length).toBeGreaterThan(0)
    expect(data.decorRoles.length).toBeGreaterThan(0)
  })
})
