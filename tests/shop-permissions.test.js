import request from 'supertest';
import app from '../src/server.js';
import User from '../src/models/user.model.js';
import Shop from '../src/models/shop.model.js';
import ShopInvitation from '../src/models/shop-invitation.model.js';
import Product from '../src/models/product.model.js';
import Category from '../src/models/category.model.js';
import PERMISSIONS from '../src/constants/permission.constant.js';
import { SHOP_STATUS } from '../src/constants/status.constant.js';

const createToken = async (userId) => {
  const jwt = await import('jsonwebtoken');
  const { env } = await import('../src/configs/env.config.js');
  return jwt.default.sign(
    { userId: userId.toString(), role: 'member' },
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
    await Promise.all([User.deleteMany({}), Shop.deleteMany({}), ShopInvitation.deleteMany({}), Product.deleteMany({}), Category.deleteMany({})]);

    const owner = await User.create({
      name: 'Shop Owner',
      email: 'shop-owner-perm@example.com',
      password: '123456',
    });

    const staff = await User.create({
      name: 'Shop Staff',
      email: 'shop-staff-perm@example.com',
      password: '123456',
    });

    ownerId = owner._id;
    staffId = staff._id;
    ownerToken = await createToken(ownerId);
    staffToken = await createToken(staffId);

    const category = await Category.create({ name: 'Dien thoai', slug: 'dien-thoai-perm' });
    categoryId = category._id;

    const shopRes = await request(app)
      .post('/api/v1/shops')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Permission Shop' });

    expect(shopRes.statusCode).toBe(201);
    shopId = shopRes.body.data.shop._id;
    await Shop.findByIdAndUpdate(shopId, { status: SHOP_STATUS.ACTIVE });
  });

  it('should let staff CRUD products in their shop and reject products from another shop', async () => {
    const beforeAssignRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Product',
        description: 'Product created by staff in shop',
        price: 1200000,
        listingType: 'sell',
        condition: 'good',
        category: categoryId,
        shop: shopId,
      });

    expect(beforeAssignRes.statusCode).toBe(403);
    expect(beforeAssignRes.body.success).toBe(false);

    const addStaffRes = await request(app)
      .post(`/api/v1/shops/${shopId}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'shop-staff-perm@example.com' });

    expect(addStaffRes.statusCode).toBe(201);
    expect(addStaffRes.body.success).toBe(true);

    const acceptRes = await request(app)
      .post(`/api/v1/shops/invitations/${addStaffRes.body.data.invitation._id}/action`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ action: 'accept' });

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.body.success).toBe(true);

    const createBeforePermissionRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Product',
        description: 'Product created by staff in shop',
        price: 1200000,
        listingType: 'sell',
        condition: 'good',
        category: categoryId,
        shop: shopId,
      });

    expect(createBeforePermissionRes.statusCode).toBe(403);
    expect(createBeforePermissionRes.body.success).toBe(false);

    const updatePermRes = await request(app)
      .put(`/api/v1/shops/${shopId}/staff/${staffId}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        permissions: [
          PERMISSIONS.PRODUCT_CREATE,
          PERMISSIONS.PRODUCT_READ,
          PERMISSIONS.PRODUCT_UPDATE,
          PERMISSIONS.PRODUCT_DELETE,
        ],
      });

    expect(updatePermRes.statusCode).toBe(200);
    expect(updatePermRes.body.success).toBe(true);
    expect(updatePermRes.body.data.permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.PRODUCT_CREATE,
        PERMISSIONS.PRODUCT_READ,
        PERMISSIONS.PRODUCT_UPDATE,
        PERMISSIONS.PRODUCT_DELETE,
      ])
    );

    const createProductRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        title: 'Staff Product',
        description: 'Product created by staff in shop',
        price: 1200000,
        listingType: 'sell',
        condition: 'good',
        category: categoryId,
        shop: shopId,
      });

    expect(createProductRes.statusCode).toBe(201);
    expect(createProductRes.body.success).toBe(true);
    expect(createProductRes.body.data.product.shop).toBe(shopId.toString());

    const staffListRes = await request(app)
      .get(`/api/v1/shops/${shopId}/staff`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(staffListRes.statusCode).toBe(200);
    expect(staffListRes.body.success).toBe(true);
    expect(staffListRes.body.data.staff).toHaveLength(1);
    expect(staffListRes.body.data.staff[0].user._id).toBe(staffId.toString());
    expect(staffListRes.body.data.staff[0].permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.PRODUCT_CREATE,
        PERMISSIONS.PRODUCT_READ,
        PERMISSIONS.PRODUCT_UPDATE,
        PERMISSIONS.PRODUCT_DELETE,
      ])
    );

    const listProductsRes = await request(app)
      .get(`/api/v1/shops/${shopId}/products`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(listProductsRes.statusCode).toBe(200);
    expect(listProductsRes.body.success).toBe(true);
    expect(listProductsRes.body.data.products.some((product) => product._id === createProductRes.body.data.product._id)).toBe(true);

    const updateProductRes = await request(app)
      .patch(`/api/v1/products/${createProductRes.body.data.product._id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ price: 1300000 });

    expect(updateProductRes.statusCode).toBe(200);
    expect(updateProductRes.body.success).toBe(true);
    expect(updateProductRes.body.data.product.price).toBe(1300000);

    const otherOwner = await User.create({
      name: 'Other Shop Owner',
      email: 'other-shop-owner@example.com',
      password: '123456',
      roles: ['shop_owner'],
    });
    const otherShop = await Shop.create({
      name: 'Other Permission Shop',
      slug: 'other-permission-shop',
      owner: otherOwner._id,
      status: SHOP_STATUS.ACTIVE,
    });
    const otherProduct = await Product.create({
      title: 'Other Shop Product',
      description: 'Product owned by another shop',
      price: 2200000,
      listingType: 'sell',
      condition: 'good',
      category: categoryId,
      owner: otherOwner._id,
      shop: otherShop._id,
    });

    const listOtherShopProductsRes = await request(app)
      .get(`/api/v1/shops/${otherShop._id}/products`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(listOtherShopProductsRes.statusCode).toBe(403);
    expect(listOtherShopProductsRes.body.success).toBe(false);

    const updateOtherProductRes = await request(app)
      .patch(`/api/v1/products/${otherProduct._id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ price: 2300000 });

    expect(updateOtherProductRes.statusCode).toBe(403);
    expect(updateOtherProductRes.body.success).toBe(false);

    const deleteOtherProductRes = await request(app)
      .delete(`/api/v1/products/${otherProduct._id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(deleteOtherProductRes.statusCode).toBe(403);
    expect(deleteOtherProductRes.body.success).toBe(false);

    const deleteProductRes = await request(app)
      .delete(`/api/v1/products/${createProductRes.body.data.product._id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(deleteProductRes.statusCode).toBe(200);
    expect(deleteProductRes.body.success).toBe(true);

    const deletedProduct = await Product.findById(createProductRes.body.data.product._id);
    expect(deletedProduct.isActive).toBe(false);
  });
});
