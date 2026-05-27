import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import ShopInvitation from '../src/models/shop-invitation.model.js';
import { createToken } from './fixtures/testData.js'
import { SHOP_STATUS } from '../src/constants/status.constant.js'

let ownerId;
let staffId;
let outsiderId;
let ownerToken;
let staffToken;
let outsiderToken;
let shopId;

describe('Shop API', () => {
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Shop.deleteMany({}), ShopInvitation.deleteMany({})]);

    const owner = await User.create({
      name: 'Shop Owner Candidate',
      email: 'shop-owner@example.com',
      password: '123456',
      role: 'member',
      roles: ['member'],
    });

    const staff = await User.create({
      name: 'Shop Staff Candidate',
      email: 'shop-staff@example.com',
      password: '123456',
      role: 'member',
      roles: ['member'],
    });

    const outsider = await User.create({
      name: 'Other Shop Owner',
      email: 'shop-outsider@example.com',
      password: '123456',
      role: 'shop_owner',
      roles: ['shop_owner'],
    });

    ownerId = owner._id;
    staffId = staff._id;
    outsiderId = outsider._id;

    ownerToken = await createToken(ownerId, 'member');
    staffToken = await createToken(staffId, 'member');
    outsiderToken = await createToken(outsiderId, 'shop_owner');
  });

  it('should create a shop', async () => {
    const res = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Anh Decor Shop',
        description: 'Noi that va decor',
        phone: '0900000001',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shop.owner._id).toBe(ownerId.toString());
    expect(res.body.data.shop.status).toBe(SHOP_STATUS.DRAFT);

    shopId = res.body.data.shop._id;
    expect(shopId).toBeDefined();
  });

  it('should allow owner to update own shop', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    const updateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Updated profile' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.shop.description).toBe('Updated profile');
  });

  it('should allow draft shop owner with user role to submit for review', async () => {
    await User.findByIdAndUpdate(ownerId, {
      kyc: {
        fullName: 'Shop Owner Candidate',
        idNumber: '079123456789',
        status: 'pending',
        submittedAt: new Date(),
      },
    });

    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Submit Review Shop',
        phone: '0900000001',
        email: 'submit-review-shop@example.com',
        address: {
          province: 'Ho Chi Minh',
          district: 'District 1',
        },
      });

    shopId = createRes.body.data.shop._id;

    const submitRes = await request(app)
      .post(`/api/v1/shops/${shopId}/submit`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.data.shop.status).toBe('pending_review');
  });

  it('should reject another shop_owner updating shop outside scope', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    const updateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ description: 'Should not pass' });

    expect(updateRes.statusCode).toBe(403);
    expect(updateRes.body.success).toBe(false);
  });

  it('should invite staff and staff can update shop after accepting invitation', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    const directAddStaffRes = await request(app)
      .post(`/api/v1/shops/${shopId}/staff`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ staffUserId: staffId.toString() });

    expect([404, 405]).toContain(directAddStaffRes.statusCode);

    const inviteRes = await request(app)
      .post(`/api/v1/shops/${shopId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-staff@example.com' });

    expect(inviteRes.statusCode).toBe(201);
    expect(inviteRes.body.success).toBe(true);
    expect(inviteRes.body.data.invitation.status).toBe('pending');

    const beforeAcceptShop = await Shop.findById(shopId);
    expect(beforeAcceptShop.staff.map((item) => item.toString())).not.toContain(staffId.toString());

    const duplicateInviteRes = await request(app)
      .post(`/api/v1/shops/${shopId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-staff@example.com' });

    expect(duplicateInviteRes.statusCode).toBe(409);

    const acceptRes = await request(app)
      .post(`/api/v1/shops/invitations/${inviteRes.body.data.invitation._id}/action`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ action: 'accept' });

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    const alreadyStaffInviteRes = await request(app)
      .post(`/api/v1/shops/${shopId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-staff@example.com' });

    expect(alreadyStaffInviteRes.statusCode).toBe(400);

    const permissionRes = await request(app)
      .put(`/api/v1/shops/${shopId}/staff/${staffId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissions: ['shop:update', 'shop:read'] });

    expect(permissionRes.statusCode).toBe(200);
    expect(permissionRes.body.success).toBe(true);

    const updateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ phone: '0900000002' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);

    const dashboardRes = await request(app)
      .get(`/api/v1/shops/${shopId}/dashboard`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.body.success).toBe(true);
    expect(dashboardRes.body.data.shop._id).toBe(shopId.toString());

    const mineRes = await request(app)
      .get('/api/v1/shops/mine')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(mineRes.statusCode).toBe(200);
    expect(mineRes.body.success).toBe(true);
    expect(mineRes.body.data.shops).toHaveLength(1);
  });

  it('should transfer owner successfully', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    const transferRes = await request(app)
      .patch(`/api/v1/shops/${shopId}/owner`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-outsider@example.com' });

    expect(transferRes.statusCode).toBe(200);
    expect(transferRes.body.success).toBe(true);
    expect(transferRes.body.data.shop.owner._id).toBe(outsiderId.toString());

    const newOwnerUpdateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ description: 'Managed by new owner' });

    expect(newOwnerUpdateRes.statusCode).toBe(200);
    expect(newOwnerUpdateRes.body.data.shop.description).toBe('Managed by new owner');

    const oldOwnerUpdateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Old owner should not manage' });

    expect(oldOwnerUpdateRes.statusCode).toBe(403);
  });

  it('should reject invalid shop owner transfer attempts', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Transfer Guard Shop' });

    shopId = createRes.body.data.shop._id;

    const selfTransferRes = await request(app)
      .patch(`/api/v1/shops/${shopId}/owner`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-owner@example.com' });

    expect(selfTransferRes.statusCode).toBe(400);

    const missingUserRes = await request(app)
      .patch(`/api/v1/shops/${shopId}/owner`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'missing-owner@example.com' });

    expect(missingUserRes.statusCode).toBe(404);

    const forbiddenRes = await request(app)
      .patch(`/api/v1/shops/${shopId}/owner`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ email: 'shop-outsider@example.com' });

    expect(forbiddenRes.statusCode).toBe(403);
  });

  it('should find one user by exact email for staff or owner actions', async () => {
    const candidate = await User.create({
      name: 'Shop Member Candidate',
      email: 'shop-member-candidate@example.com',
      password: '123456',
      role: 'member',
      roles: ['member'],
    })

    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    await User.findByIdAndUpdate(ownerId, { roles: ['member', 'shop_owner'] })

    const res = await request(app)
      .get(`/api/v1/shops/${shopId}/users/by-email`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ email: 'shop-member-candidate@example.com' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({
      _id: candidate._id.toString(),
      name: 'Shop Member Candidate',
      email: 'shop-member-candidate@example.com',
      avatar: { url: '', publicId: '' },
    });
    expect(res.body.data.user.roles).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();

    const missingEmailRes = await request(app)
      .get(`/api/v1/shops/${shopId}/users/by-email`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(missingEmailRes.statusCode).toBe(400);

    const notFoundRes = await request(app)
      .get(`/api/v1/shops/${shopId}/users/by-email`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .query({ email: 'missing@example.com' });
    expect(notFoundRes.statusCode).toBe(404);

    const forbiddenRes = await request(app)
      .get(`/api/v1/shops/${shopId}/users/by-email`)
      .set('Authorization', `Bearer ${staffToken}`)
      .query({ email: 'shop-member-candidate@example.com' });
    expect(forbiddenRes.statusCode).toBe(403);
  });

  describe('DELETE /api/v1/shops/:id', () => {
    it('should allow owner to soft delete a rejected shop', async () => {
      const shop = await Shop.create({
        name: 'Rejected Shop',
        slug: 'rejected-shop',
        owner: ownerId,
        status: SHOP_STATUS.REJECTED,
      })

      const res = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)

      const deletedShop = await Shop.findById(shop._id)
      expect(deletedShop.isActive).toBe(false)
      expect(deletedShop.slug).toContain('rejected-shop-deleted-')

      const publicListRes = await request(app).get('/api/v1/shops')
      expect(publicListRes.statusCode).toBe(200)
      expect(publicListRes.body.data.shops.some((item) => item._id === shop._id.toString())).toBe(false)

      const mineRes = await request(app)
        .get('/api/v1/shops/mine')
        .set('Authorization', `Bearer ${ownerToken}`)
      expect(mineRes.statusCode).toBe(200)
      expect(mineRes.body.data.shops.some((item) => item._id === shop._id.toString())).toBe(false)

      const detailRes = await request(app).get(`/api/v1/shops/${shop._id}`)
      expect(detailRes.statusCode).toBe(404)
    })

    it('should allow admin to soft delete a rejected shop', async () => {
      const admin = await User.create({
        name: 'Shop Admin',
        email: 'shop-admin@example.com',
        password: '123456',
        roles: ['admin'],
      })
      const adminToken = await createToken(admin._id, 'admin')
      const shop = await Shop.create({
        name: 'Admin Rejected Shop',
        slug: 'admin-rejected-shop',
        owner: ownerId,
        status: SHOP_STATUS.REJECTED,
      })

      const res = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.statusCode).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should reject deleting another owner rejected shop', async () => {
      const shop = await Shop.create({
        name: 'Other Owner Rejected Shop',
        slug: 'other-owner-rejected-shop',
        owner: ownerId,
        status: SHOP_STATUS.REJECTED,
      })

      const res = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)

      expect(res.statusCode).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('should reject deleting an active shop', async () => {
      const shop = await Shop.create({
        name: 'Active Shop',
        slug: 'active-shop-delete-test',
        owner: ownerId,
        status: SHOP_STATUS.ACTIVE,
      })

      const res = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should reject deleting a pending review shop', async () => {
      const shop = await Shop.create({
        name: 'Pending Shop',
        slug: 'pending-shop-delete-test',
        owner: ownerId,
        status: SHOP_STATUS.PENDING_REVIEW,
      })

      const res = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should return 404 when shop does not exist', async () => {
      const missingShopId = '507f1f77bcf86cd799439011'

      const res = await request(app)
        .delete(`/api/v1/shops/${missingShopId}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.statusCode).toBe(404)
      expect(res.body.success).toBe(false)
    })

    it('should allow owner to create a new shop after deleting a rejected shop', async () => {
      const shop = await Shop.create({
        name: 'Retry Shop',
        slug: 'retry-shop',
        owner: ownerId,
        status: SHOP_STATUS.REJECTED,
      })

      const deleteRes = await request(app)
        .delete(`/api/v1/shops/${shop._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(deleteRes.statusCode).toBe(200)

      const createRes = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Retry Shop',
          phone: '0900000001',
        })

      expect(createRes.statusCode).toBe(201)
      expect(createRes.body.success).toBe(true)
      expect(createRes.body.data.shop.owner._id).toBe(ownerId.toString())
      expect(createRes.body.data.shop.slug).toBe('retry-shop')
      expect(createRes.body.data.shop.status).toBe(SHOP_STATUS.DRAFT)
    })
  })
});
