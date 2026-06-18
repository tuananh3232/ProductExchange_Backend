import request from 'supertest'
import app from '../../src/server.js'
import { env } from '../../src/configs/env.config.js'
import { ROLES } from '../../src/constants/role.constant.js'
import { SHOP_STATUS } from '../../src/constants/status.constant.js'
import { resetTestDatabase } from '../setup/test-db.js'
import { createTestUser, loginAdmin, loginMember } from '../setup/auth.js'
import { createSampleProduct, createSampleShop } from '../setup/factories.js'
import AuditLog from '../../src/models/audit-log.model.js'
import Notification from '../../src/models/notification.model.js'
import Shop from '../../src/models/shop.model.js'
import User from '../../src/models/user.model.js'

const api = env.apiPrefix

beforeEach(async () => {
  await resetTestDatabase()
})

describe('admin audit, report, and notification flows', () => {
  it('exposes admin filter options only to admins', async () => {
    const { token: adminToken } = await loginAdmin()
    const { token: memberToken } = await loginMember()

    const adminResponse = await request(app)
      .get(`${api}/admin/products/filter-options`)
      .set('Authorization', `Bearer ${adminToken}`)

    const memberResponse = await request(app)
      .get(`${api}/admin/products/filter-options`)
      .set('Authorization', `Bearer ${memberToken}`)

    expect(adminResponse.status).toBe(200)
    expect(adminResponse.body.success).toBe(true)
    expect(adminResponse.body.data).toBeTruthy()
    expect(memberResponse.status).toBe(403)
  })

  it('records shop suspension history without overwriting rejection reason', async () => {
    const { user: admin, token } = await loginAdmin()
    const shop = await createSampleShop({ status: SHOP_STATUS.ACTIVE, rejectionReason: '' })

    const response = await request(app)
      .patch(`${api}/admin/shops/${shop._id}/suspend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Repeated policy violation' })

    const storedShop = await Shop.findById(shop._id)
    const historyResponse = await request(app)
      .get(`${api}/admin/shops/${shop._id}/review-history`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.shop.status).toBe(SHOP_STATUS.SUSPENDED)
    expect(storedShop.rejectionReason).toBe('')
    expect(storedShop.suspensionMeta.reasonText).toBe('Repeated policy violation')
    expect(storedShop.suspensionMeta.suspendedBy.toString()).toBe(admin._id.toString())
    expect(historyResponse.status).toBe(200)
    expect(historyResponse.body.data.history.map((entry) => entry.action)).toContain('SHOP_SUSPENDED')
  })

  it('stores KYC reviewer and exposes user activity audit history', async () => {
    const { user: admin, token } = await loginAdmin()
    const target = await createTestUser({
      kyc: {
        status: 'pending',
        fullName: 'Audit User',
        idNumber: '123456789012',
        submittedAt: new Date(),
      },
    })

    const response = await request(app)
      .patch(`${api}/admin/users/${target._id}/kyc/approve`)
      .set('Authorization', `Bearer ${token}`)

    const storedUser = await User.findById(target._id)
    const activityResponse = await request(app)
      .get(`${api}/admin/users/${target._id}/activity`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(storedUser.kyc.status).toBe('approved')
    expect(storedUser.kyc.reviewedBy.toString()).toBe(admin._id.toString())
    expect(storedUser.kyc.reviewHistory).toHaveLength(1)
    expect(activityResponse.status).toBe(200)
    expect(activityResponse.body.data.activities.map((entry) => entry.action)).toContain('KYC_APPROVED')
  })

  it('exports sanitized CSV reports and rejects unsupported report types', async () => {
    const { token } = await loginAdmin()
    await createTestUser({
      email: 'report-user@example.com',
      kyc: {
        status: 'pending',
        fullName: 'Report User',
        idNumber: '999999999999',
        submittedAt: new Date(),
      },
    })

    const invalidResponse = await request(app)
      .get(`${api}/admin/reports/export`)
      .query({ type: 'secrets', fromDate: '2026-01-01', toDate: '2026-01-02' })
      .set('Authorization', `Bearer ${token}`)

    const validResponse = await request(app)
      .get(`${api}/admin/reports/export`)
      .query({ type: 'users', fromDate: '2020-01-01', toDate: '2020-01-31' })
      .set('Authorization', `Bearer ${token}`)

    expect(invalidResponse.status).toBe(400)
    expect(validResponse.status).toBe(200)
    expect(validResponse.headers['content-type']).toContain('text/csv')
    expect(validResponse.text).toContain('id,name,email,roles,isActive,createdAt')
    expect(validResponse.text).not.toContain('999999999999')
    expect(validResponse.text).not.toContain('idNumber')
  })

  it('creates admin notifications and records RBAC audit events', async () => {
    const { token } = await loginAdmin()
    const target = await createTestUser({ email: 'admin-rbac@example.com' })

    const invalidNotification = await request(app)
      .post(`${api}/admin/notifications`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Invalid target',
        message: 'Should fail',
        targetType: 'users',
        targetIds: ['not-an-object-id'],
      })

    const notificationResponse = await request(app)
      .post(`${api}/admin/notifications`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Admin Notice',
        message: 'Admin notification test',
        targetType: 'users',
        targetIds: [target._id.toString()],
      })

    const assignResponse = await request(app)
      .patch(`${api}/admin/rbac/users/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: target.email, roles: [ROLES.MEMBER, ROLES.SELLER] })

    const listResponse = await request(app)
      .get(`${api}/admin/notifications`)
      .set('Authorization', `Bearer ${token}`)

    const roleAudit = await AuditLog.findOne({ targetId: target._id, action: 'USER_ROLE_CHANGED' })
    const adminNotification = await Notification.findOne({ recipient: target._id, title: 'Admin Notice' })

    expect(invalidNotification.status).toBe(400)
    expect(notificationResponse.status).toBe(200)
    expect(notificationResponse.body.data.recipientCount).toBe(1)
    expect(assignResponse.status).toBe(200)
    expect(roleAudit).toBeTruthy()
    expect(adminNotification.createdBy).toBeTruthy()
    expect(adminNotification.recipientCount).toBe(1)
    expect(listResponse.status).toBe(200)
    expect(listResponse.body.data.notifications.map((item) => item.title)).toContain('Admin Notice')
  })

  it('exposes product moderation history from audit logs', async () => {
    const { token } = await loginAdmin()
    const product = await createSampleProduct({ status: 'available', isActive: true })

    const hideResponse = await request(app)
      .patch(`${api}/admin/products/${product._id}/hide`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Unsafe listing' })

    const historyResponse = await request(app)
      .get(`${api}/admin/products/${product._id}/moderation-history`)
      .set('Authorization', `Bearer ${token}`)

    expect(hideResponse.status).toBe(200)
    expect(historyResponse.status).toBe(200)
    expect(historyResponse.body.data.history.map((entry) => entry.action)).toContain('PRODUCT_HIDDEN')
  })
})
