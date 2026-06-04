import request from 'supertest'
import User from '../src/models/user.model.js'
import Product from '../src/models/product.model.js'
import Category from '../src/models/category.model.js'
import RoomProject from '../src/models/room-project.model.js'
import RoomScene from '../src/models/room-scene.model.js'
import { createToken } from './fixtures/testData.js'

jest.unstable_mockModule('../src/utils/cloudinary.util.js', () => ({
  uploadBuffer: jest.fn().mockResolvedValue({
    url: 'https://res.cloudinary.com/test/room-scenes/test.jpg',
    publicId: 'room-scenes/test-123',
    width: 1920,
    height: 1080,
  }),
  deleteImage: jest.fn().mockResolvedValue(true),
  configure: jest.fn(),
}))

let app
let uploadBuffer

beforeAll(async () => {
  const serverModule = await import('../src/server.js')
  app = serverModule.default
  const cloudinaryModule = await import('../src/utils/cloudinary.util.js')
  uploadBuffer = cloudinaryModule.uploadBuffer
})

const FUTURE_VIP = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
const PAST_VIP = new Date(Date.now() - 1000 * 60 * 60 * 24)

// Cutout seeded vào product để dùng cho placement tests
const CUTOUT_PUBLIC_ID = 'products/cutouts/cutout-abc'
const SEEDED_CUTOUT = {
  view: 'front',
  url: 'https://res.cloudinary.com/test/cutout.png',
  publicId: CUTOUT_PUBLIC_ID,
  widthPx: 400,
  heightPx: 600,
  status: 'ready',
  provider: 'manual',
}

describe('Room Visualizer API', () => {
  let vipUser, vipToken
  let expiredVipUser, expiredVipToken
  let member, memberToken
  let admin, adminToken
  let product

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Category.deleteMany({}),
      RoomProject.deleteMany({}),
      RoomScene.deleteMany({}),
    ])
    uploadBuffer.mockClear()

    vipUser = await User.create({
      name: 'VIP User',
      email: 'vip@example.com',
      password: '123456',
      roles: ['member'],
      vip: { expiresAt: FUTURE_VIP },
    })
    vipToken = await createToken(vipUser._id, 'member')

    expiredVipUser = await User.create({
      name: 'Expired VIP',
      email: 'expired@example.com',
      password: '123456',
      roles: ['member'],
      vip: { expiresAt: PAST_VIP },
    })
    expiredVipToken = await createToken(expiredVipUser._id, 'member')

    member = await User.create({
      name: 'Member',
      email: 'member@example.com',
      password: '123456',
      roles: ['member'],
    })
    memberToken = await createToken(member._id, 'member')

    admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: '123456',
      roles: ['admin'],
    })
    adminToken = await createToken(admin._id, 'admin')

    const category = await Category.create({ name: 'Đồ decor', slug: 'do-decor' })

    product = await Product.create({
      title: 'Bàn decor',
      description: 'Bàn decor đẹp',
      price: 500000,
      stock: 3,
      listingType: 'sell',
      condition: 'new',
      location: { province: 'Hà Nội', district: 'Hoàn Kiếm' },
      owner: admin._id,
      category: category._id,
      isActive: true,
      dimensions: { widthCm: 60, heightCm: 80, depthCm: 40 },
      visualProfile: { isVisualizerReady: true },
      visualAssets: { cutouts: [SEEDED_CUTOUT] },
    })
  })

  // ─── requireVip enforcement ──────────────────────────────────────────────────

  describe('requireVip enforcement', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/room-projects')
      expect(res.statusCode).toBe(401)
    })

    it('returns 403 VIP_REQUIRED for member without VIP', async () => {
      const res = await request(app)
        .get('/api/v1/room-projects')
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.statusCode).toBe(403)
      expect(res.body.error).toBe('VIP_REQUIRED')
    })

    it('returns 403 for member with expired VIP', async () => {
      const res = await request(app)
        .get('/api/v1/room-projects')
        .set('Authorization', `Bearer ${expiredVipToken}`)
      expect(res.statusCode).toBe(403)
      expect(res.body.error).toBe('VIP_REQUIRED')
    })

    it('allows VIP user through', async () => {
      const res = await request(app)
        .get('/api/v1/room-projects')
        .set('Authorization', `Bearer ${vipToken}`)
      expect(res.statusCode).toBe(200)
    })

    it('allows admin through without VIP', async () => {
      const res = await request(app)
        .get('/api/v1/room-projects')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.statusCode).toBe(200)
    })
  })

  // ─── Room Project CRUD ────────────────────────────────────────────────────────

  describe('Room Project CRUD', () => {
    it('creates project (POST /room-projects)', async () => {
      const res = await request(app)
        .post('/api/v1/room-projects')
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ name: 'Phòng khách', description: 'Phòng khách nhà tôi' })

      expect(res.statusCode).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.project.name).toBe('Phòng khách')
      expect(res.body.data.project.owner).toBe(vipUser._id.toString())
    })

    it('returns 422 when project name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/room-projects')
        .set('Authorization', `Bearer ${vipToken}`)
        .send({})
      expect(res.statusCode).toBe(422)
    })

    it('lists only own projects (GET /room-projects)', async () => {
      await RoomProject.create({ owner: vipUser._id, name: 'My Project' })
      await RoomProject.create({ owner: admin._id, name: 'Admin Project' }) // không thuộc vipUser

      const res = await request(app)
        .get('/api/v1/room-projects')
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.projects.length).toBe(1)
      expect(res.body.data.projects[0].name).toBe('My Project')
    })

    it('gets project by id (GET /room-projects/:id)', async () => {
      const project = await RoomProject.create({ owner: vipUser._id, name: 'Detail Test' })

      const res = await request(app)
        .get(`/api/v1/room-projects/${project._id}`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.project.name).toBe('Detail Test')
    })

    it('returns 404 for another user\'s project', async () => {
      const adminProject = await RoomProject.create({ owner: admin._id, name: 'Admin Only' })

      const res = await request(app)
        .get(`/api/v1/room-projects/${adminProject._id}`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(404)
    })

    it('updates project (PATCH /room-projects/:id)', async () => {
      const project = await RoomProject.create({ owner: vipUser._id, name: 'Old Name' })

      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ name: 'New Name' })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.project.name).toBe('New Name')
    })

    it('soft deletes project (DELETE /room-projects/:id → archived)', async () => {
      const project = await RoomProject.create({ owner: vipUser._id, name: 'To Delete' })

      const res = await request(app)
        .delete(`/api/v1/room-projects/${project._id}`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      const inDb = await RoomProject.findById(project._id)
      expect(inDb.status).toBe('archived')
    })

    it('returns 400 PROJECT_LIMIT_EXCEEDED when over limit', async () => {
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          RoomProject.create({ owner: vipUser._id, name: `Project ${i}` })
        )
      )

      const res = await request(app)
        .post('/api/v1/room-projects')
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ name: 'One More' })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('PROJECT_LIMIT_EXCEEDED')
    })
  })

  // ─── Room Scene CRUD ──────────────────────────────────────────────────────────

  describe('Room Scene CRUD', () => {
    let project

    beforeEach(async () => {
      project = await RoomProject.create({ owner: vipUser._id, name: 'Scene Test Project' })
    })

    it('creates scene (POST /:projectId/scenes)', async () => {
      const res = await request(app)
        .post(`/api/v1/room-projects/${project._id}/scenes`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ name: 'Phòng ngủ' })

      expect(res.statusCode).toBe(201)
      expect(res.body.data.scene.name).toBe('Phòng ngủ')
    })

    it('returns 422 when scene name is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/room-projects/${project._id}/scenes`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({})
      expect(res.statusCode).toBe(422)
    })

    it('lists scenes in project (GET /:projectId/scenes)', async () => {
      await RoomScene.insertMany([
        { project: project._id, owner: vipUser._id, name: 'Scene A' },
        { project: project._id, owner: vipUser._id, name: 'Scene B' },
      ])

      const res = await request(app)
        .get(`/api/v1/room-projects/${project._id}/scenes`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.scenes.length).toBe(2)
    })

    it('updates scene name (PATCH /:projectId/scenes/:sceneId)', async () => {
      const scene = await RoomScene.create({ project: project._id, owner: vipUser._id, name: 'Old' })

      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}/scenes/${scene._id}`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ name: 'Updated' })

      expect(res.statusCode).toBe(200)
      expect(res.body.data.scene.name).toBe('Updated')
    })

    it('soft deletes scene (DELETE → isActive false)', async () => {
      const scene = await RoomScene.create({ project: project._id, owner: vipUser._id, name: 'Gone' })

      const res = await request(app)
        .delete(`/api/v1/room-projects/${project._id}/scenes/${scene._id}`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      const inDb = await RoomScene.findById(scene._id)
      expect(inDb.isActive).toBe(false)
    })
  })

  // ─── Scene Image Upload ───────────────────────────────────────────────────────

  describe('POST /:projectId/scenes/:sceneId/image', () => {
    it('uploads room image and persists metadata + resets calibration', async () => {
      const project = await RoomProject.create({ owner: vipUser._id, name: 'Img Project' })
      const scene = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Photo Scene',
        calibration: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, realLengthCm: 50, pixelsPerCm: 2 },
      })

      uploadBuffer.mockResolvedValueOnce({
        url: 'https://res.cloudinary.com/test/room.jpg',
        publicId: 'room-scenes/room-001',
        width: 1920,
        height: 1080,
      })

      const res = await request(app)
        .post(`/api/v1/room-projects/${project._id}/scenes/${scene._id}/image`)
        .set('Authorization', `Bearer ${vipToken}`)
        .attach('image', Buffer.from('fake-room-photo'), 'room.jpg')

      expect(res.statusCode).toBe(200)
      const inDb = await RoomScene.findById(scene._id)
      expect(inDb.image.url).toBe('https://res.cloudinary.com/test/room.jpg')
      expect(inDb.image.widthPx).toBe(1920)
      expect(inDb.image.heightPx).toBe(1080)
      expect(inDb.calibration.pixelsPerCm).toBeNull() // reset sau khi đổi ảnh
    })
  })

  // ─── Calibration ─────────────────────────────────────────────────────────────

  describe('PATCH /:projectId/scenes/:sceneId/calibration', () => {
    let project, sceneWithImage

    beforeEach(async () => {
      project = await RoomProject.create({ owner: vipUser._id, name: 'Cal Project' })
      sceneWithImage = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Has Image',
        image: {
          url: 'https://example.com/room.jpg',
          publicId: 'room-scenes/p1',
          widthPx: 1920,
          heightPx: 1080,
        },
      })
    })

    it('computes pixelsPerCm correctly', async () => {
      // 480px / 200cm = 2.4 px/cm
      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}/scenes/${sceneWithImage._id}/calibration`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ start: { x: 0, y: 540 }, end: { x: 480, y: 540 }, realLengthCm: 200 })

      expect(res.statusCode).toBe(200)
      const inDb = await RoomScene.findById(sceneWithImage._id)
      expect(inDb.calibration.pixelsPerCm).toBeCloseTo(2.4, 1)
      expect(inDb.calibration.realLengthCm).toBe(200)
      expect(inDb.calibration.calibratedAt).not.toBeNull()
    })

    it('returns 400 CALIBRATION_OUT_OF_BOUNDS for coordinates outside image', async () => {
      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}/scenes/${sceneWithImage._id}/calibration`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ start: { x: 0, y: 0 }, end: { x: 9999, y: 0 }, realLengthCm: 200 })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('CALIBRATION_OUT_OF_BOUNDS')
    })

    it('returns 400 SCENE_NO_IMAGE when scene has no image', async () => {
      const emptyScene = await RoomScene.create({ project: project._id, owner: vipUser._id, name: 'No Image' })

      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}/scenes/${emptyScene._id}/calibration`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, realLengthCm: 50 })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('SCENE_NO_IMAGE')
    })

    it('returns 422 when realLengthCm is 0 (min: 1)', async () => {
      const res = await request(app)
        .patch(`/api/v1/room-projects/${project._id}/scenes/${sceneWithImage._id}/calibration`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, realLengthCm: 0 })

      expect(res.statusCode).toBe(422)
    })
  })

  // ─── Placements ───────────────────────────────────────────────────────────────

  describe('PUT /:projectId/scenes/:sceneId/placements', () => {
    let project, calibratedScene

    beforeEach(async () => {
      project = await RoomProject.create({ owner: vipUser._id, name: 'Placement Project' })
      calibratedScene = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Calibrated',
        image: {
          url: 'https://example.com/room.jpg',
          publicId: 'room-scenes/cal',
          widthPx: 1920,
          heightPx: 1080,
        },
        calibration: {
          start: { x: 0, y: 0 },
          end: { x: 240, y: 0 },
          realLengthCm: 100,
          pixelsPerCm: 2.4,
          calibratedAt: new Date(),
        },
      })
    })

    it('saves placements successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${calibratedScene._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({
          placements: [
            {
              product: product._id.toString(),
              cutoutPublicId: CUTOUT_PUBLIC_ID,
              view: 'front',
              x: 300,
              y: 400,
              scale: 1,
              zIndex: 1,
            },
          ],
        })

      expect(res.statusCode).toBe(200)
      const inDb = await RoomScene.findById(calibratedScene._id)
      expect(inDb.placements.length).toBe(1)
      expect(inDb.placements[0].x).toBe(300)
    })

    it('replaces all placements on subsequent save (idempotent)', async () => {
      const placement = { product: product._id.toString(), cutoutPublicId: CUTOUT_PUBLIC_ID, view: 'front', x: 100, y: 100 }
      await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${calibratedScene._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ placements: [placement] })

      // Gọi lần 2 với x/y khác nhau → replace hoàn toàn lần trước
      const res = await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${calibratedScene._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({ placements: [{ ...placement, x: 999, y: 888 }] })

      expect(res.statusCode).toBe(200)
      const inDb = await RoomScene.findById(calibratedScene._id)
      expect(inDb.placements.length).toBe(1)
      expect(inDb.placements[0].x).toBe(999)
      expect(inDb.placements[0].y).toBe(888)
    })

    it('returns 400 SCENE_NOT_CALIBRATED when pixelsPerCm is null', async () => {
      const uncalibrated = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Uncalibrated',
        image: { url: 'https://example.com/room.jpg', publicId: 'room-scenes/unc', widthPx: 1920, heightPx: 1080 },
      })

      const res = await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${uncalibrated._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({
          placements: [
            { product: product._id.toString(), cutoutPublicId: CUTOUT_PUBLIC_ID, view: 'front', x: 0, y: 0 },
          ],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('SCENE_NOT_CALIBRATED')
    })

    it('returns 400 PRODUCT_NOT_VISUALIZER_READY for product without ready flag', async () => {
      const notReady = await Product.create({
        title: 'Not Ready',
        description: 'desc',
        price: 100000,
        stock: 1,
        listingType: 'sell',
        condition: 'new',
        location: { province: 'Hà Nội', district: 'Hoàn Kiếm' },
        owner: admin._id,
        category: product.category,
        isActive: true,
        visualProfile: { isVisualizerReady: false },
      })

      const res = await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${calibratedScene._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({
          placements: [
            { product: notReady._id.toString(), cutoutPublicId: 'some/id', view: 'front', x: 0, y: 0 },
          ],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('PRODUCT_NOT_VISUALIZER_READY')
    })

    it('returns 400 CUTOUT_NOT_FOUND when cutoutPublicId does not match product', async () => {
      const res = await request(app)
        .put(`/api/v1/room-projects/${project._id}/scenes/${calibratedScene._id}/placements`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send({
          placements: [
            {
              product: product._id.toString(),
              cutoutPublicId: 'products/cutouts/wrong-id',
              view: 'front',
              x: 0,
              y: 0,
            },
          ],
        })

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('CUTOUT_NOT_FOUND')
    })
  })

  // ─── Export ───────────────────────────────────────────────────────────────────

  describe('GET /:projectId/scenes/:sceneId/export', () => {
    let project

    beforeEach(async () => {
      project = await RoomProject.create({ owner: vipUser._id, name: 'Export Project' })
    })

    it('returns 400 SCENE_NO_IMAGE when scene has no image', async () => {
      const emptyScene = await RoomScene.create({ project: project._id, owner: vipUser._id, name: 'Empty' })

      const res = await request(app)
        .get(`/api/v1/room-projects/${project._id}/scenes/${emptyScene._id}/export`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('SCENE_NO_IMAGE')
    })

    it('returns fully populated export data including productInfo', async () => {
      const scene = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Full Scene',
        image: {
          url: 'https://example.com/room.jpg',
          publicId: 'room-scenes/exp1',
          widthPx: 1920,
          heightPx: 1080,
        },
        calibration: {
          start: { x: 0, y: 0 },
          end: { x: 240, y: 0 },
          realLengthCm: 100,
          pixelsPerCm: 2.4,
          calibratedAt: new Date(),
        },
        placements: [
          {
            product: product._id,
            cutoutPublicId: CUTOUT_PUBLIC_ID,
            view: 'front',
            x: 300,
            y: 400,
            scale: 1,
            zIndex: 1,
          },
        ],
      })

      const res = await request(app)
        .get(`/api/v1/room-projects/${project._id}/scenes/${scene._id}/export`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)

      const { data } = res.body
      expect(data.image.url).toBe('https://example.com/room.jpg')
      expect(data.calibration.pixelsPerCm).toBe(2.4)
      expect(data.placements.length).toBe(1)

      const placement = data.placements[0]
      expect(placement.productInfo.title).toBe('Bàn decor')
      expect(placement.productInfo.dimensions.widthCm).toBe(60)
      expect(placement.productInfo.isVisualizerReady).toBe(true)
      expect(placement.productInfo.cutout.publicId).toBe(CUTOUT_PUBLIC_ID)
    })

    it('returns placement with productInfo null when product no longer exists', async () => {
      const deletedProductId = new (await import('mongoose')).default.Types.ObjectId()
      const scene = await RoomScene.create({
        project: project._id,
        owner: vipUser._id,
        name: 'Orphan Placement',
        image: { url: 'https://example.com/r.jpg', publicId: 'room-scenes/or1', widthPx: 800, heightPx: 600 },
        calibration: { pixelsPerCm: 2, start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, realLengthCm: 100, calibratedAt: new Date() },
        placements: [
          { product: deletedProductId, cutoutPublicId: 'products/cutouts/ghost', view: 'front', x: 0, y: 0 },
        ],
      })

      const res = await request(app)
        .get(`/api/v1/room-projects/${project._id}/scenes/${scene._id}/export`)
        .set('Authorization', `Bearer ${vipToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.data.placements[0].productInfo).toBeNull()
    })
  })
})
