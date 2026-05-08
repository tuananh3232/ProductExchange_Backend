import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import crypto from 'crypto';
import { TEST_USER } from './fixtures/testData.js'

const LOGIN_USER = {
  email: TEST_USER.email,
  password: TEST_USER.password,
};

describe('Auth API', () => {
  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(TEST_USER.email);
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should fail if email already exists', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should fail if password does not match', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...TEST_USER,
          confirmPassword: 'different',
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);
    });

    it('should login successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(LOGIN_USER);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(LOGIN_USER.email);
    });

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid@example.com',
          password: '123456',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: LOGIN_USER.email,
          password: 'wrongpassword',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/me', () => {
    let token;

    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(LOGIN_USER);

      token = loginRes.body.data.accessToken;
    });

    it('should get current user profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toEqual({
        name: TEST_USER.name,
        phone: '',
        address: {
          province: '',
          district: '',
          detail: '',
        },
      });
    });

    it('should fail without token', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let token;

    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(LOGIN_USER);

      token = loginRes.body.data.accessToken;
    });

    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/auth/profile', () => {
    let token;

    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(LOGIN_USER);

      token = loginRes.body.data.accessToken;
    });

    it('should update user profile', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          phone: '0901234567',
          address: {
            province: 'Hà Nội',
            district: 'Hoàn Kiếm',
            detail: '123 Đường ABC',
          },
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Updated Name');
      expect(res.body.data.user.phone).toBe('0901234567');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .send({ name: 'New Name' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with empty update data', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send(LOGIN_USER);

      token = loginRes.body.data.accessToken;
    });

    it('should change password successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: '123456',
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: LOGIN_USER.email,
          password: 'newpassword123',
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.data.accessToken).toBeDefined();
    });

    it('should fail with wrong current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      await User.findOneAndUpdate(
        { email: TEST_USER.email },
        {
          isVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }
      );
    });

    it('should issue reset password token for existing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: TEST_USER.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.debugOtp).toMatch(/^\d{6}$/);

      const user = await User.findOne({ email: TEST_USER.email }).select('+resetPasswordToken +resetPasswordExpires');
      expect(user.resetPasswordToken).toBeDefined();
      expect(user.resetPasswordExpires).toBeDefined();
    });

    it('should return success even when email does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'unknown@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not issue reset otp for unverified account', async () => {
      await User.findOneAndUpdate(
        { email: TEST_USER.email },
        {
          isVerified: false,
          emailVerifiedAt: null,
        }
      );

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: TEST_USER.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const user = await User.findOne({ email: TEST_USER.email }).select('+resetPasswordToken +resetPasswordExpires');
      expect(user.resetPasswordToken).toBeFalsy();
      expect(user.resetPasswordExpires).toBeFalsy();
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);

      const rawToken = '123456';
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
      await User.findOneAndUpdate(
        { email: TEST_USER.email },
        {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000),
        }
      );

      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: TEST_USER.email,
          otp: rawToken,
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123',
        });

      expect(resetRes.statusCode).toBe(200);
      expect(resetRes.body.success).toBe(true);

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: TEST_USER.email,
          password: 'newpassword123',
        });

      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: TEST_USER.email,
          otp: '000000',
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/send-verification-email and /verify-email', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send(TEST_USER);
    });

    it('should create verification otp', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-verification-email')
        .send({ email: TEST_USER.email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.debugOtp).toMatch(/^\d{6}$/);

      const user = await User.findOne({ email: TEST_USER.email }).select('+emailVerificationToken +emailVerificationExpires');
      expect(user.emailVerificationToken).toBeDefined();
      expect(user.emailVerificationExpires).toBeDefined();
    });

    it('should verify email with valid otp', async () => {
      const rawOtp = '123456';
      const hashedToken = crypto.createHash('sha256').update(rawOtp).digest('hex');
      await User.findOneAndUpdate(
        { email: TEST_USER.email },
        {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
          isVerified: false,
        }
      );

      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ otp: rawOtp });

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      const verifiedUser = await User.findOne({ email: TEST_USER.email });
      expect(verifiedUser.isVerified).toBe(true);
    });

    it('should still verify email with token alias', async () => {
      const rawOtp = '654321';
      const hashedToken = crypto.createHash('sha256').update(rawOtp).digest('hex');
      await User.findOneAndUpdate(
        { email: TEST_USER.email },
        {
          emailVerificationToken: hashedToken,
          emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
          isVerified: false,
        }
      );

      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: rawOtp });

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      const verifiedUser = await User.findOne({ email: TEST_USER.email });
      expect(verifiedUser.isVerified).toBe(true);
    });
  });
});
