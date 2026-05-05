import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';

let adminId;
let userId;
let adminToken;

const createToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign(
    { userId: userId.toString(), role: 'admin' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

describe('Admin API', () => {
  beforeEach(async () => {
    // Clear users
    await User.deleteMany({});

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
          password: '12345',
        });

      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.body.success).toBe(false);
    });

    it('should fail if not admin', async () => {
      // Create regular token
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../src/configs/env.config.js');
      const userToken = jwt.default.sign(
        { userId: userId.toString(), role: 'user' },
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
          password: '12345',
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should fail if not admin', async () => {
      const jwt = await import('jsonwebtoken');
      const { env } = await import('../src/configs/env.config.js');
      const userToken = jwt.default.sign(
        { userId: userId.toString(), role: 'user' },
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
});
