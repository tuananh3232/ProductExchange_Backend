import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';

let adminId;
let userId;
let adminToken;

const createToken = async (userId, role = 'admin') => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign(
    { userId: userId.toString(), role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

describe('Admin API', () => {
  beforeEach(async () => {
    // Clear users
    await Promise.all([User.deleteMany({}), Product.deleteMany({}), Category.deleteMany({})]);

    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: '123456',
      role: 'admin',
      roles: ['admin'],
    });
    adminId = admin._id;
    adminToken = await createToken(adminId);

    // Create regular user
    const user = await User.create({
      name: 'Regular User',
      email: 'user@example.com',
      password: '123456',
      isVerified: true,
      emailVerifiedAt: new Date(),
    });
    userId = user._id;
  });

  describe('PATCH /api/v1/admin/users/:userId/ban', () => {
    it('should ban user as admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Violating terms of service',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(false);

      // Verify user cannot login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: '123456',
        });

      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.body.success).toBe(false);
    });

    it('should fail if not admin', async () => {
      // Create regular token
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../src/configs/env.config.js');
      const userToken = jwt.default.sign(
        { userId: userId.toString(), role: 'member' },
        env.jwt.secret,
        { expiresIn: env.jwt.expiresIn }
      );

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/ban`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Test',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/ban`)
        .send({ reason: 'Test' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with non-existent user', async () => {
      const fakeId = '999999999999999999999999';
      const res = await request(app)
        .patch(`/api/v1/admin/users/${fakeId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test' });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/unban', () => {
    beforeEach(async () => {
      // Ban the user first
      await User.findByIdAndUpdate(userId, { isActive: false });
    });

    it('should unban user as admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isActive).toBe(true);

      // Verify user can login again
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: '123456',
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should fail if not admin', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../src/configs/env.config.js');
      const userToken = jwt.default.sign(
        { userId: userId.toString(), role: 'member' },
        env.jwt.secret,
        { expiresIn: env.jwt.expiresIn }
      );

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/unban`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/unban`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should return paginated users for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Regular' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.users[0].email).toBe('user@example.com');
    });
  });

  describe('GET /api/v1/admin/kyc', () => {
    it('should return paginated KYC applications for admin', async () => {
      await User.findByIdAndUpdate(userId, {
        kyc: {
          fullName: 'Regular User',
          idNumber: '123456789012',
          status: 'pending',
          submittedAt: new Date(),
        },
      });

      const res = await request(app)
        .get('/api/v1/admin/kyc')
        .query({ status: 'pending', page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.kycs)).toBe(true);
      expect(res.body.data.kycs[0].kyc.status).toBe('pending');
      expect(res.body.meta).toBeDefined();
    });

    it('should reject non-admin from listing KYC applications', async () => {
      const userToken = await createToken(userId, 'member');

      const res = await request(app)
        .get('/api/v1/admin/kyc')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/kyc', () => {
    it('should add seller role when admin approves KYC', async () => {
      await User.findByIdAndUpdate(userId, {
        roles: ['member', 'shop_owner', 'staff'],
        kyc: {
          fullName: 'Regular User',
          idNumber: '123456789012',
          status: 'pending',
          submittedAt: new Date(),
        },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/kyc/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.roles).toEqual(expect.arrayContaining(['member', 'shop_owner', 'staff', 'seller']));

      const user = await User.findById(userId);
      expect(user.roles.filter((role) => role === 'seller')).toHaveLength(1);
    });

    it('should not duplicate seller role when admin approves KYC for an existing seller', async () => {
      await User.findByIdAndUpdate(userId, {
        roles: ['member', 'seller', 'shop_owner', 'staff'],
        kyc: {
          fullName: 'Regular User',
          idNumber: '123456789012',
          status: 'pending',
          submittedAt: new Date(),
        },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/kyc/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.roles).toEqual(expect.arrayContaining(['member', 'seller', 'shop_owner', 'staff']));
      expect(res.body.data.user.roles.filter((role) => role === 'seller')).toHaveLength(1);

      const user = await User.findById(userId);
      expect(user.roles.filter((role) => role === 'seller')).toHaveLength(1);
    });

    it('should not add seller role when admin rejects KYC', async () => {
      await User.findByIdAndUpdate(userId, {
        roles: ['member'],
        kyc: {
          fullName: 'Regular User',
          idNumber: '123456789012',
          status: 'pending',
          submittedAt: new Date(),
        },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/kyc/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Invalid document' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.roles).not.toContain('seller');
    });

    it('should not revoke an existing seller role when admin rejects a new pending KYC', async () => {
      await User.findByIdAndUpdate(userId, {
        roles: ['member', 'seller'],
        kyc: {
          fullName: 'Regular User',
          idNumber: '123456789012',
          status: 'pending',
          submittedAt: new Date(),
        },
      });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${userId}/kyc/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Invalid document' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.roles).toEqual(expect.arrayContaining(['member', 'seller']));
    });
  });

  describe('GET /api/v1/admin/products', () => {
    it('should return all products for admin without public status filtering', async () => {
      const category = await Category.create({ name: 'Admin Products', slug: 'admin-products' });
      await Product.create([
        {
          title: 'Available admin product',
          description: 'Product visible in public listing',
          price: 100000,
          listingType: 'sell',
          condition: 'good',
          category: category._id,
          owner: userId,
          ownerType: 'SELLER',
          seller: userId,
          status: 'available',
        },
        {
          title: 'Hidden admin product',
          description: 'Product hidden from public listing',
          price: 200000,
          listingType: 'sell',
          condition: 'good',
          category: category._id,
          owner: userId,
          ownerType: 'SELLER',
          seller: userId,
          status: 'hidden',
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products.map((product) => product.status)).toEqual(
        expect.arrayContaining(['available', 'hidden'])
      );
    });
  });
});
