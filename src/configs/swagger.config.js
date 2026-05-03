import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.config.js';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ProductExchange API',
    version: '1.0.0',
    description: 'API cho nền tảng mua bán và trao đổi sản phẩm',
    contact: { name: 'Dev Team', email: 'dev@productexchange.vn' },
  },
  servers: [
    { url: `http://localhost:${env.port}`, description: 'Development' },
    { url: 'https://api.productexchange.vn', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // ===== User =====
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
          name: { type: 'string', example: 'Nguyễn Văn A' },
          email: { type: 'string', example: 'a@example.com' },
          avatar: {
            type: 'object',
            properties: { url: { type: 'string' }, publicId: { type: 'string' } },
          },
          phone: { type: 'string', example: '0901234567' },
          role: { type: 'string', enum: ['user', 'admin', 'seller', 'shop_owner', 'staff', 'delivery'] },
          roles: {
            type: 'array',
            items: { type: 'string' },
          },
          rating: {
            type: 'object',
            properties: { average: { type: 'number' }, count: { type: 'integer' } },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ===== Product =====
      Product: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string', example: 'iPhone 14 Pro Max 256GB' },
          description: { type: 'string' },
          price: { type: 'number', example: 25000000 },
          listingType: { type: 'string', enum: ['sell', 'exchange', 'both'] },
          condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
          status: { type: 'string', enum: ['available', 'pending', 'sold', 'exchanged', 'hidden'] },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { url: { type: 'string' }, publicId: { type: 'string' } },
            },
          },
          category: { $ref: '#/components/schemas/Category' },
          owner: { $ref: '#/components/schemas/User' },
          views: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Shop: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Shop Anh Decor' },
          slug: { type: 'string', example: 'shop-anh-decor' },
          description: { type: 'string' },
          logo: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              publicId: { type: 'string' },
            },
          },
          phone: { type: 'string', example: '0901234567' },
          email: { type: 'string', example: 'shop@example.com' },
          address: {
            type: 'object',
            properties: {
              province: { type: 'string' },
              district: { type: 'string' },
              detail: { type: 'string' },
            },
          },
          owner: { $ref: '#/components/schemas/User' },
          staff: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' },
          },
          staffPermissions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                staffUser: { $ref: '#/components/schemas/User' },
                permissions: {
                  type: 'array',
                  items: { type: 'string' },
                },
                updatedBy: { $ref: '#/components/schemas/User' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          buyer: { $ref: '#/components/schemas/User' },
          shop: { $ref: '#/components/schemas/Shop' },
          product: { $ref: '#/components/schemas/Product' },
          deliveryStaff: { $ref: '#/components/schemas/User' },
          quantity: { type: 'integer' },
          unitPrice: { type: 'number' },
          totalAmount: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled'] },
          shippingAddress: {
            type: 'object',
            properties: {
              recipientName: { type: 'string' },
              phone: { type: 'string' },
              province: { type: 'string' },
              district: { type: 'string' },
              detail: { type: 'string' },
            },
          },
          history: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                note: { type: 'string' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Delivery: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          order: { $ref: '#/components/schemas/Order' },
          shop: { $ref: '#/components/schemas/Shop' },
          buyer: { $ref: '#/components/schemas/User' },
          deliveryStaff: { $ref: '#/components/schemas/User' },
          status: { type: 'string', enum: ['assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed'] },
          history: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                note: { type: 'string' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          order: { $ref: '#/components/schemas/Order' },
          buyer: { $ref: '#/components/schemas/User' },
          amount: { type: 'number' },
          provider: { type: 'string', example: 'vnpay' },
          method: { type: 'string', example: 'vnpay' },
          status: { type: 'string', enum: ['unpaid', 'pending_payment', 'paid', 'failed', 'cancelled'] },
          transactionRef: { type: 'string' },
          bankCode: { type: 'string' },
          responseCode: { type: 'string' },
          vnpTransactionNo: { type: 'string' },
          paidAt: { type: 'string', format: 'date-time' },
        },
      },
      Permission: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string', example: 'product:create' },
          name: { type: 'string', example: 'Tạo sản phẩm' },
        },
      },
      Role: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string', example: 'shop_owner' },
          name: { type: 'string', example: 'Shop Owner' },
          permissions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Permission' },
          },
        },
      },
      // ===== Category =====
      Category: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'Điện thoại' },
          slug: { type: 'string', example: 'dien-thoai' },
        },
      },
      // ===== Exchange =====
      Exchange: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          requester: { $ref: '#/components/schemas/User' },
          receiver: { $ref: '#/components/schemas/User' },
          requestedProduct: { $ref: '#/components/schemas/Product' },
          offeredProduct: { $ref: '#/components/schemas/Product' },
          message: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] },
          history: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                note: { type: 'string' },
                updatedBy: { $ref: '#/components/schemas/User' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // ===== Responses chuẩn =====
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Thao tác thành công' },
          data: { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                  hasNextPage: { type: 'boolean' },
                  hasPrevPage: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Đã xảy ra lỗi' },
          error: { type: 'string', example: 'Error message in English' },
          details: {
            type: 'object',
            additionalProperties: true,
            description: 'Thông tin lỗi chi tiết, thường dùng cho validation',
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // JSDoc annotations
};

const rawSwaggerSpec = swaggerJsdoc(options);
const normalizedApiPrefix = env.apiPrefix && env.apiPrefix !== '/'
  ? env.apiPrefix.replace(/\/+$/, '')
  : '';

const prefixedPaths = Object.fromEntries(
  Object.entries(rawSwaggerSpec.paths || {}).map(([path, pathItem]) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const finalPath = normalizedApiPrefix
      ? `${normalizedApiPrefix}${normalizedPath}`
      : normalizedPath;
    return [finalPath, pathItem];
  })
);

export const swaggerSpec = {
  ...rawSwaggerSpec,
  paths: prefixedPaths,
};
