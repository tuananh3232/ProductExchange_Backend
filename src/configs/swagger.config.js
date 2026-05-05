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
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          avatar: {
            type: 'object',
            properties: { url: { type: 'string' }, publicId: { type: 'string' } },
          },
          phone: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin', 'seller', 'shop_owner', 'staff'] },
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
          title: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          listingType: { type: 'string', enum: ['sell'] },
          condition: { type: 'string', enum: ['new', 'like_new', 'good', 'fair', 'poor'] },
          status: { type: 'string', enum: ['available', 'pending', 'sold', 'hidden'] },
          images: {
            type: 'array',
            items: {
              type: 'object',
              properties: { url: { type: 'string' }, publicId: { type: 'string' } },
            },
          },
          category: { $ref: '#/components/schemas/Category' },
          owner: { $ref: '#/components/schemas/User' },
          shop: { type: 'string', nullable: true },
          location: {
            type: 'object',
            properties: {
              province: { type: 'string' },
              district: { type: 'string' },
            },
          },
          views: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Shop: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          logo: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              publicId: { type: 'string' },
            },
          },
          phone: { type: 'string' },
          email: { type: 'string' },
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
          status: {
            type: 'string',
            enum: ['draft', 'pending_review', 'active', 'rejected', 'suspended'],
            description: 'Trạng thái onboarding của shop',
          },
          rejectionReason: {
            type: 'string',
            description: 'Lý do từ chối (admin điền khi reject)',
          },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          buyer: { $ref: '#/components/schemas/User' },
          shop: { $ref: '#/components/schemas/Shop' },
          product: { $ref: '#/components/schemas/Product' },
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
      Payment: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          order: { $ref: '#/components/schemas/Order' },
          buyer: { $ref: '#/components/schemas/User' },
          amount: { type: 'number' },
          provider: { type: 'string' },
          method: { type: 'string' },
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
          code: { type: 'string' },
          name: { type: 'string' },
        },
      },
      Role: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          code: { type: 'string' },
          name: { type: 'string' },
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
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          icon: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      // ===== Responses chuẩn =====
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
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
          success: { type: 'boolean' },
          message: { type: 'string' },
          error: { type: 'string' },
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
  apis: ['./src/routes/**/*.js', './src/controllers/**/*.js'], // JSDoc annotations
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
