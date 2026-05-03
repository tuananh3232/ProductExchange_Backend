import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';

let ownerId;
let staffId;
let outsiderId;
let ownerToken;
let staffToken;
let outsiderToken;
let shopId;

const createToken = async (userId, role = 'user') => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
};

describe('Shop API', () => {
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Shop.deleteMany({})]);

    const owner = await User.create({
      name: 'Shop Owner Candidate',
      email: 'shop-owner@example.com',
      password: 'password123',
      role: 'user',
      roles: ['user'],
    });

    const staff = await User.create({
      name: 'Shop Staff Candidate',
      email: 'shop-staff@example.com',
      password: 'password123',
      role: 'user',
      roles: ['user'],
    });

    const outsider = await User.create({
      name: 'Other Shop Owner',
      email: 'shop-outsider@example.com',
      password: 'password123',
      role: 'shop_owner',
      roles: ['shop_owner'],
    });

    ownerId = owner._id;
    staffId = staff._id;
    outsiderId = outsider._id;

    ownerToken = await createToken(ownerId, 'user');
    staffToken = await createToken(staffId, 'user');
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

  it('should add staff and staff can update shop', async () => {
    const createRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Anh Decor Shop' });

    shopId = createRes.body.data.shop._id;

    const addStaffRes = await request(app)
      .post(`/api/v1/shops/${shopId}/staff`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ staffUserId: staffId.toString() });

    expect(addStaffRes.statusCode).toBe(200);
    expect(addStaffRes.body.success).toBe(true);

    const updateRes = await request(app)
      .put(`/api/v1/shops/${shopId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ phone: '0900000002' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
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
      .send({ newOwnerId: outsiderId.toString() });

    expect(transferRes.statusCode).toBe(200);
    expect(transferRes.body.success).toBe(true);
    expect(transferRes.body.data.shop.owner._id).toBe(outsiderId.toString());
  });
});
