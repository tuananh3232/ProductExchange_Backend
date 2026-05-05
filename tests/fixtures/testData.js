import User from '../../src/models/user.model.js'

export const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: '123456',
  confirmPassword: '123456',
}

export const TEST_CATEGORY = {
  name: 'Đồ trang trí',
  slug: 'do-trang-tri',
}

export const TEST_CATEGORIES = [
  {
    name: 'Đồ trang trí',
    slug: 'do-trang-tri',
  },
  {
    name: 'Đèn decor',
    slug: 'den-decor',
  },
  {
    name: 'Tranh treo tường',
    slug: 'tranh-treo-tuong',
  },
  {
    name: 'Kệ decor',
    slug: 'ke-decor',
  },
]

const buildDecorProducts = (prefix, categoryLabel, basePrice, location, condition = 'good') =>
  Array.from({ length: 10 }, (_, index) => {
    const itemNumber = index + 1
    return {
      title: `${prefix} ${itemNumber}`,
      description: `${categoryLabel} số ${itemNumber} dành cho không gian decor phòng và nhà.`,
      price: basePrice + index * 100000,
      listingType: 'sell',
      condition: index % 3 === 0 ? 'new' : condition,
      exchangeFor: '',
      location,
    }
  })

export const TEST_PRODUCT = {
  title: 'Bàn trang trí phòng khách',
  description: 'Bàn trang trí bằng gỗ tự nhiên, phong cách Scandinavian, thích hợp cho phòng khách và phòng trà.',
  price: 1500000,
  listingType: 'sell',
  condition: 'good',
  exchangeFor: '',
  location: {
    province: 'Hà Nội',
    district: 'Hoàn Kiếm',
  },
}

export const TEST_PRODUCTS = [
  {
    title: 'Bàn trang trí phòng khách',
    description: 'Bàn decor gỗ tự nhiên, phù hợp phòng khách phong cách Scandinavian.',
    price: 1500000,
    listingType: 'sell',
    condition: 'good',
    exchangeFor: '',
    location: {
      province: 'Hà Nội',
      district: 'Hoàn Kiếm',
    },
  },
  {
    title: 'Đèn bàn decor ánh vàng',
    description: 'Đèn bàn ánh vàng tạo không gian ấm áp cho phòng ngủ và góc đọc sách.',
    price: 850000,
    listingType: 'sell',
    condition: 'like_new',
    exchangeFor: '',
    location: {
      province: 'Đà Nẵng',
      district: 'Sơn Trà',
    },
  },
  {
    title: 'Tranh treo tường canvas tối giản',
    description: 'Bộ tranh canvas tông be nâu, hợp với phòng khách hiện đại.',
    price: 1200000,
    listingType: 'sell',
    condition: 'new',
    exchangeFor: '',
    location: {
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 3',
    },
  },
]

export const TEST_PRODUCTS_BY_CATEGORY = {
  'do-trang-tri': buildDecorProducts('Bàn decor', 'Đồ trang trí', 750000, {
    province: 'Hà Nội',
    district: 'Hoàn Kiếm',
  }),
  'den-decor': buildDecorProducts('Đèn decor', 'Đèn decor', 450000, {
    province: 'Đà Nẵng',
    district: 'Sơn Trà',
  }, 'like_new'),
  'tranh-treo-tuong': buildDecorProducts('Tranh treo tường', 'Tranh treo tường', 600000, {
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
  }),
  'ke-decor': buildDecorProducts('Kệ decor', 'Kệ decor', 900000, {
    province: 'Hải Phòng',
    district: 'Lê Chân',
  }, 'good'),
}

export const createToken = async (userId, role = 'user') => {
  const jwt = await import('jsonwebtoken')
  const { env } = await import('../../src/configs/env.config.js')
  return jwt.default.sign({ userId: userId.toString(), role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn })
}

export const createUser = async (overrides = {}) => {
  const data = { ...TEST_USER, ...overrides }
  return User.create(data)
}
