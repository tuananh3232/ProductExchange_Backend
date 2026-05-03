import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Role from '../src/models/role.model.js';
import Permission from '../src/models/permission.model.js';
import { ensureRbacSeedData } from '../src/services/rbac-seed.service.js';

let adminId;
let userId;
let adminToken;
let userToken;

const createToken = async (userId, role = 'user') => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
};

describe('RBAC API', () => {
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Role.deleteMany({}), Permission.deleteMany({})]);
    await ensureRbacSeedData();

    const admin = await User.create({
      name: 'Admin',
      email: 'admin-rbac@example.com',
      password: 'password123',
      role: 'admin',
      roles: ['admin'],
    });

    const user = await User.create({
      name: 'Normal User',
      email: 'user-rbac@example.com',
      password: 'password123',
      role: 'user',
      roles: ['user'],
    });

    adminId = admin._id;
    userId = user._id;
    adminToken = await createToken(adminId, 'admin');
    userToken = await createToken(userId, 'user');
  });

  describe('GET /api/v1/admin/rbac/permissions', () => {
    it('should allow admin to get permissions list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/rbac/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissions.length).toBeGreaterThan(0);
    });

    it('should reject normal user', async () => {
      const res = await request(app)
        .get('/api/v1/admin/rbac/permissions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/admin/rbac/users/:userId/roles', () => {
    it('should assign multiple roles to user', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/rbac/users/${userId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['user', 'seller'] });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.roles).toEqual(expect.arrayContaining(['user', 'seller']));
    });
  });

  describe('PUT /api/v1/admin/rbac/roles/:roleCode/permissions', () => {
    it('should update role permissions from database and affect authorization', async () => {
      const updateRes = await request(app)
        .put('/api/v1/admin/rbac/roles/seller/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permissionKeys: [
            'product:create',
            'product:read',
            'product:update',
            'product:delete',
            'user:read',
            'user:update',
            'admin:manage_users',
          ],
        });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.success).toBe(true);

      await request(app)
        .patch(`/api/v1/admin/rbac/users/${userId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['seller'] });

      const sellerToken = await createToken(userId, 'seller');
      const banRes = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/ban`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ reason: 'permission test' });

      expect(banRes.statusCode).toBe(200);
      expect(banRes.body.success).toBe(true);
    });
  });
});
