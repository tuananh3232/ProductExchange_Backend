import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import PERMISSIONS from '../src/constants/permission.constant.js';

const createToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign(
    { userId: userId.toString(), role: 'user' },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
};

describe('Shop staff permissions', () => {
  let ownerId;
  let staffId;
  let ownerToken;
  let staffToken;
  let shopId;
  let categoryId;

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Shop.deleteMany({}), Product.deleteMany({}), Category.deleteMany({})]);

    const owner = await User.create({
      name: 'Shop Owner',
      email: 'shop-owner-perm@example.com',
      password: 'password123',
    });

    const staff = await User.create({
      name: 'Shop Staff',
      email: 'shop-staff-perm@example.com',
      password: 'password123',
    });

    ownerId = owner._id;
    staffId = staff._id;
    ownerToken = await createToken(ownerId);
    staffToken = await createToken(staffId);

    const category = await Category.create({ name: 'Điện thoại', slug: 'dien-thoai-perm' });
    categoryId = category._id;

    const shopRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Permission Shop' });

    expect(shopRes.statusCode).toBe(201);
    shopId = shopRes.body.data.shop._id;

    const addStaffRes = await request(app)
      .post(`/api/v1/shops/${shopId}/staff`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ staffUserId: staffId.toString() });

    expect(addStaffRes.statusCode).toBe(200);
  });

  it('should let owner tick permissions for staff and staff create a product in the shop', async () => {
    const beforeAssignRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Product',
        description: 'Sản phẩm do staff tạo trong shop',
        price: 1200000,
        listingType: 'sell',
        condition: 'good',
        category: categoryId,
        shop: shopId,
      });

    expect(beforeAssignRes.statusCode).toBe(403);
    expect(beforeAssignRes.body.success).toBe(false);

    const updatePermRes = await request(app)
      .put(`/api/v1/shops/${shopId}/staff/${staffId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ permissions: [PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_UPDATE] });

    expect(updatePermRes.statusCode).toBe(200);
    expect(updatePermRes.body.success).toBe(true);
    expect(updatePermRes.body.data.permissions).toEqual(expect.arrayContaining([PERMISSIONS.PRODUCT_CREATE, PERMISSIONS.PRODUCT_UPDATE]));

    const afterAssignRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Product',
        description: 'Sản phẩm do staff tạo trong shop',
        price: 1200000,
        listingType: 'sell',
        condition: 'good',
        category: categoryId,
        shop: shopId,
      });

    expect(afterAssignRes.statusCode).toBe(201);
    expect(afterAssignRes.body.success).toBe(true);
    expect(afterAssignRes.body.data.product.shop).toBe(shopId.toString());
  });
});
