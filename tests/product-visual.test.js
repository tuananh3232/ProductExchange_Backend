import request from 'supertest'
import User from '../src/models/user.model.js'
import Product from '../src/models/product.model.js'
import Category from '../src/models/category.model.js'
import Shop from '../src/models/shop.model.js'
import { SHOP_STATUS } from '../src/constants/status.constant.js'
import { TEST_CATEGORIES, TEST_PRODUCTS_BY_CATEGORY, createToken } from './fixtures/testData.js'

// Phải mock trước khi app được import động — cloudinary không được resolve trước
jest.unstable_mockModule('../src/utils/cloudinary.util.js', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    url: 'https://res.cloudinary.com/test/image/upload/products/test.jpg',
    publicId: 'products/source/test-123',
    width: 800,
    height: 600,
  }),
  deleteImage: jest.fn().mockResolvedValue(true),
  configure: jest.fn(),
}))

jest.unstable_mockModule('../src/services/visual-assets/background-removal.service.js', () => ({
  removeBackground: jest.fn().mockResolvedValue({
    buffer: Buffer.from('bg-removed-result'),
    mimeType: 'image/png',
  }),
}))

let app
let uploadBuffer
let deleteImage
let removeBackground

beforeAll(async () => {
  const serverModule = await import('../src/server.js')
  app = serverModule.default
  const cloudinaryModule = await import('../src/utils/cloudinary.util.js')
  uploadBuffer = cloudinaryModule.uploadBuffer
  deleteImage = cloudinaryModule.deleteImage
  const bgModule = await import('../src/services/visual-assets/background-removal.service.js')
  removeBackground = bgModule.removeBackground
})

const seedCategories = async () => {
  await Category.bulkWrite(
    TEST_CATEGORIES.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: { $setOnInsert: c },
        upsert: true,
      },
    }))
  )
  const docs = await Category.find({ slug: { $in: TEST_CATEGORIES.map((c) => c.slug) } })
  return Object.fromEntries(docs.map((c) => [c.slug, c]))
}

describe('Product Visual Asset API', () => {
  let shopOwner
  let shopOwnerToken
  let otherShopOwner
  let otherShopOwnerToken
  let member
  let memberToken
  let shop
  let product
  let categoryId

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Category.deleteMany({}),
      Shop.deleteMany({}),
    ])

    uploadBuffer.mockClear()
    deleteImage.mockClear()
    if (removeBackground) removeBackground.mockClear()

    const categoriesBySlug = await seedCategories()
    categoryId = categoriesBySlug['do-trang-tri']._id

    shopOwner = await User.create({
      name: 'Visual Shop Owner',
      email: 'visual-owner@example.com',
      password: '123456',
      roles: ['shop_owner'],
    })
    shopOwnerToken = await createToken(shopOwner._id, 'shop_owner')

    otherShopOwner = await User.create({
      name: 'Other Visual Shop Owner',
      email: 'other-visual-owner@example.com',
      password: '123456',
      roles: ['shop_owner'],
    })
    otherShopOwnerToken = await createToken(otherShopOwner._id, 'shop_owner')

    member = await User.create({
      name: 'Visual Member',
      email: 'visual-member@example.com',
      password: '123456',
      roles: ['member'],
    })
    memberToken = await createToken(member._id, 'member')

    shop = await Shop.create({
      name: 'Visual Test Shop',
      slug: 'visual-test-shop',
      owner: shopOwner._id,
      staff: [],
      status: SHOP_STATUS.ACTIVE,
    })

    product = await Product.create({
      ...TEST_PRODUCTS_BY_CATEGORY['do-trang-tri'][0],
      owner: shopOwner._id,
      category: categoryId,
      shop: shop._id,
    })
  })

  // ─── POST /:id/visual-assets/source ──────────────────────────────────────────

  describe('POST /api/v1/products/:id/visual-assets/source', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/source`)
        .attach('image', Buffer.from('fake-data'), 'test.jpg')

      expect(res.statusCode).toBe(401)
      expect(res.body.success).toBe(false)
    })

    it('should return 400 for invalid product ObjectId', async () => {
      const res = await request(app)
        .post('/api/v1/products/invalid-id/visual-assets/source')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .attach('image', Buffer.from('fake-data'), 'test.jpg')

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 403 for member (no product_visual_asset:manage permission)', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/source`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('image', Buffer.from('fake-data'), 'test.jpg')

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should return 403 for shop_owner who does not own the product shop', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/source`)
        .set('Authorization', `Bearer ${otherShopOwnerToken}`)
        .attach('image', Buffer.from('fake-data'), 'test.jpg')

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should upload source image and persist url/publicId to DB', async () => {
      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/image/upload/products/source/src-001.jpg',
        publicId: 'products/source/src-001',
        width: 1000,
        height: 800,
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/source`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .attach('image', Buffer.from('fake-jpg-data'), 'photo.jpg')

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(uploadBuffer).toHaveBeenCalledTimes(1)
      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        'products/source',
        { format: 'jpg' }
      )

      const updated = await Product.findById(product._id)
      expect(updated.visualAssets.sourceImage.url).toBe(
        'https://res.cloudinary.com/test/image/upload/products/source/src-001.jpg'
      )
      expect(updated.visualAssets.sourceImage.publicId).toBe('products/source/src-001')
    })

    it('should delete old source image from Cloudinary before uploading new one', async () => {
      await Product.findByIdAndUpdate(product._id, {
        'visualAssets.sourceImage': {
          url: 'https://old.cloudinary.com/old.jpg',
          publicId: 'products/source/old-src-xyz',
        },
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/source`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .attach('image', Buffer.from('new-data'), 'new.jpg')

      expect(res.statusCode).toBe(200)
      expect(deleteImage).toHaveBeenCalledWith('products/source/old-src-xyz')
      expect(uploadBuffer).toHaveBeenCalledTimes(1)
    })
  })

  // ─── POST /:id/visual-assets/cutout ──────────────────────────────────────────

  describe('POST /api/v1/products/:id/visual-assets/cutout', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .attach('image', Buffer.from('fake-data'), 'cutout.png')

      expect(res.statusCode).toBe(401)
    })

    it('should return 400 for invalid product ObjectId', async () => {
      const res = await request(app)
        .post('/api/v1/products/not-an-id/visual-assets/cutout')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .attach('image', Buffer.from('fake-data'), 'cutout.png')

      expect(res.statusCode).toBe(400)
    })

    it('should return 403 for member', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${memberToken}`)
        .attach('image', Buffer.from('fake-data'), 'cutout.png')

      expect(res.statusCode).toBe(403)
    })

    it('should return 422 for invalid view enum value', async () => {
      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .field('view', 'top_angle')
        .attach('image', Buffer.from('fake-data'), 'cutout.png')

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('should upload cutout with widthPx/heightPx from Cloudinary result', async () => {
      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/image/upload/products/cutouts/cut-001.png',
        publicId: 'products/cutouts/cut-001',
        width: 500,
        height: 800,
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .field('view', 'front')
        .field('provider', 'manual')
        .attach('image', Buffer.from('fake-png'), 'cutout.png')

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        'products/cutouts',
        { format: 'png' }
      )

      const updated = await Product.findById(product._id)
      const added = updated.visualAssets.cutouts[0]
      expect(added.view).toBe('front')
      expect(added.publicId).toBe('products/cutouts/cut-001')
      expect(added.widthPx).toBe(500)
      expect(added.heightPx).toBe(800)
      expect(added.status).toBe('ready')
      expect(added.provider).toBe('manual')
    })

    it('should set isVisualizerReady=true when dimensions are set and front cutout is ready', async () => {
      await Product.findByIdAndUpdate(product._id, {
        'dimensions.widthCm': 60,
        'dimensions.heightCm': 90,
      })

      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/cutout.png',
        publicId: 'products/cutouts/cut-dim',
        width: 400,
        height: 600,
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .field('view', 'front')
        .attach('image', Buffer.from('fake-png'), 'cutout.png')

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.visualProfile.isVisualizerReady).toBe(true)
    })

    it('should NOT set isVisualizerReady=true when dimensions are not set', async () => {
      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/cutout.png',
        publicId: 'products/cutouts/cut-nodim',
        width: 400,
        height: 600,
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .field('view', 'front')
        .attach('image', Buffer.from('fake-png'), 'cutout.png')

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.visualProfile.isVisualizerReady).toBe(false)
    })

    it('should call removeBackground and upload the processed buffer when provider=remove_bg', async () => {
      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/cutouts/removed.png',
        publicId: 'products/cutouts/removed-001',
        width: 500,
        height: 700,
      })

      const res = await request(app)
        .post(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .field('view', 'front')
        .field('provider', 'remove_bg')
        .attach('image', Buffer.from('original-png'), 'photo.png')

      expect(res.statusCode).toBe(200)
      expect(removeBackground).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        provider: 'remove_bg',
      })
      // uploadBuffer nhận buffer đã xử lý từ removeBackground (không phải buffer gốc)
      expect(uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        'products/cutouts',
        { format: 'png' }
      )

      const updated = await Product.findById(product._id)
      expect(updated.visualAssets.cutouts[0].provider).toBe('remove_bg')
      expect(updated.visualAssets.cutouts[0].publicId).toBe('products/cutouts/removed-001')
    })
  })

  // ─── PATCH /:id/visual-profile ────────────────────────────────────────────────

  describe('PATCH /api/v1/products/:id/visual-profile', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .send({ dimensions: { widthCm: 50, heightCm: 80 } })

      expect(res.statusCode).toBe(401)
    })

    it('should return 400 for invalid product ObjectId', async () => {
      const res = await request(app)
        .patch('/api/v1/products/bad-id/visual-profile')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 50 } })

      expect(res.statusCode).toBe(400)
    })

    it('should return 403 for member', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ dimensions: { widthCm: 50 } })

      expect(res.statusCode).toBe(403)
    })

    it('should return 403 for shop_owner who does not own the product shop', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${otherShopOwnerToken}`)
        .send({ dimensions: { widthCm: 50, heightCm: 80 } })

      expect(res.statusCode).toBe(403)
    })

    it('should return 422 when widthCm is 0 (below min: 1)', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 0, heightCm: 80 } })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('should return 422 when heightCm is 0 (below min: 1)', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 50, heightCm: 0 } })

      expect(res.statusCode).toBe(422)
      expect(res.body.success).toBe(false)
    })

    it('should allow depthCm = 0 (flat product like a painting)', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 60, heightCm: 90, depthCm: 0 } })

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.dimensions.depthCm).toBe(0)
    })

    it('should persist updated dimensions and visualProfile', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          dimensions: { widthCm: 60, heightCm: 90, depthCm: 15 },
          visualProfile: { placementType: 'floor_standing', anchor: 'bottom_center' },
        })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)

      const updated = await Product.findById(product._id)
      expect(updated.dimensions.widthCm).toBe(60)
      expect(updated.dimensions.heightCm).toBe(90)
      expect(updated.dimensions.depthCm).toBe(15)
      expect(updated.visualProfile.placementType).toBe('floor_standing')
      expect(updated.visualProfile.anchor).toBe('bottom_center')
    })

    it('should compute isVisualizerReady=true when dimensions OK and front cutout ready', async () => {
      await Product.findByIdAndUpdate(product._id, {
        $push: {
          'visualAssets.cutouts': {
            view: 'front',
            url: 'https://example.com/cutout.png',
            publicId: 'products/cutouts/pre-seeded',
            widthPx: 400,
            heightPx: 600,
            status: 'ready',
            provider: 'manual',
          },
        },
      })

      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 60, heightCm: 90 } })

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.visualProfile.isVisualizerReady).toBe(true)
    })

    it('should keep isVisualizerReady=false when no front cutout exists', async () => {
      const res = await request(app)
        .patch(`/api/v1/products/${product._id}/visual-profile`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ dimensions: { widthCm: 60, heightCm: 90 } })

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.visualProfile.isVisualizerReady).toBe(false)
    })
  })

  // ─── DELETE /:id/visual-assets/cutout?publicId=... ───────────────────────────

  describe('DELETE /api/v1/products/:id/visual-assets/cutout', () => {
    const CUTOUT_PUBLIC_ID = 'products/cutouts/front-cut-abc123'

    beforeEach(async () => {
      await Product.findByIdAndUpdate(product._id, {
        'dimensions.widthCm': 50,
        'dimensions.heightCm': 80,
        'visualProfile.isVisualizerReady': true,
        $push: {
          'visualAssets.cutouts': {
            view: 'front',
            url: 'https://example.com/cutout.png',
            publicId: CUTOUT_PUBLIC_ID,
            widthPx: 400,
            heightPx: 600,
            status: 'ready',
            provider: 'manual',
          },
        },
      })
    })

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(401)
    })

    it('should return 400 for invalid product ObjectId', async () => {
      const res = await request(app)
        .delete('/api/v1/products/invalid-id/visual-assets/cutout')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(400)
    })

    it('should return 400 when publicId query param is missing', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 403 for member', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${memberToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(403)
    })

    it('should return 403 for shop_owner who does not own the product shop', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${otherShopOwnerToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(403)
    })

    it('should return 404 when cutout publicId does not exist', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ publicId: 'products/cutouts/non-existent' })

      expect(res.statusCode).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('should accept publicId with slashes via query param (the bug fix)', async () => {
      // Đây là test chính — publicId có dạng 'products/cutouts/xxx' không thể dùng path param
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(deleteImage).toHaveBeenCalledWith(CUTOUT_PUBLIC_ID)
    })

    it('should remove cutout from DB after deletion', async () => {
      await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      const updated = await Product.findById(product._id)
      const stillExists = updated.visualAssets.cutouts.some((c) => c.publicId === CUTOUT_PUBLIC_ID)
      expect(stillExists).toBe(false)
    })

    it('should recompute isVisualizerReady=false after deleting the only front cutout', async () => {
      const res = await request(app)
        .delete(`/api/v1/products/${product._id}/visual-assets/cutout`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ publicId: CUTOUT_PUBLIC_ID })

      expect(res.statusCode).toBe(200)
      const updated = await Product.findById(product._id)
      expect(updated.visualProfile.isVisualizerReady).toBe(false)
    })
  })

  // ─── GET /products?visualizerReady=true ──────────────────────────────────────

  describe('GET /api/v1/products?visualizerReady=true', () => {
    beforeEach(async () => {
      // Tạo thêm 1 sản phẩm với isVisualizerReady=true
      await Product.create({
        ...TEST_PRODUCTS_BY_CATEGORY['do-trang-tri'][1],
        owner: shopOwner._id,
        category: categoryId,
        shop: shop._id,
        visualProfile: {
          isVisualizerReady: true,
          placementType: 'wall_mounted',
          anchor: 'center',
        },
      })
      // product từ outer beforeEach có isVisualizerReady=false (default)
    })

    it('should return only visualizerReady products when filter=true', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ visualizerReady: true })

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(1)
      res.body.data.products.forEach((p) => {
        expect(p.visualProfile.isVisualizerReady).toBe(true)
      })
    })

    it('should return all active products when visualizerReady is not set', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ page: 1, limit: 20 })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(2)
    })

    it('should not filter when visualizerReady=false is sent', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .query({ visualizerReady: false })

      expect(res.statusCode).toBe(200)
      // false không trigger filter — trả về tất cả active products
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(2)
    })
  })
})
