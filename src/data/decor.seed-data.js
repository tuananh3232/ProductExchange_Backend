export const DECOR_CATEGORIES = [
  {
    name: 'Đồ trang trí',
    slug: 'do-trang-tri',
    description: 'Các món decor giúp làm đẹp không gian sống.',
    icon: '',
  },
  {
    name: 'Đèn decor',
    slug: 'den-decor',
    description: 'Đèn bàn, đèn ngủ, đèn trang trí cho phòng.',
    icon: '',
  },
  {
    name: 'Tranh treo tường',
    slug: 'tranh-treo-tuong',
    description: 'Tranh canvas, tranh nghệ thuật, tranh tối giản.',
    icon: '',
  },
  {
    name: 'Kệ decor',
    slug: 'ke-decor',
    description: 'Kệ gỗ, kệ mini, kệ trưng bày đồ decor.',
    icon: '',
  },
]

export const DECOR_SHOPS = [
  {
    name: 'Decor House Hà Nội',
    slug: 'decor-house-ha-noi',
    description: 'Shop đồ decor tổng hợp cho phòng khách, phòng ngủ và góc làm việc.',
    phone: '0901001001',
    email: 'ha-noi@decorhouse.example',
    address: {
      province: 'Hà Nội',
      district: 'Hoàn Kiếm',
      detail: '12 Hàng Gai',
    },
  },
  {
    name: 'Decor Light Đà Nẵng',
    slug: 'decor-light-da-nang',
    description: 'Cửa hàng chuyên đèn decor, đèn bàn và phụ kiện chiếu sáng trang trí.',
    phone: '0902002002',
    email: 'da-nang@decorhouse.example',
    address: {
      province: 'Đà Nẵng',
      district: 'Sơn Trà',
      detail: '28 Trần Hưng Đạo',
    },
  },
  {
    name: 'Decor Art Sài Gòn',
    slug: 'decor-art-sai-gon',
    description: 'Shop tranh treo tường và kệ decor cho không gian hiện đại.',
    phone: '0903003003',
    email: 'sai-gon@decorhouse.example',
    address: {
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 3',
      detail: '86 Nam Kỳ Khởi Nghĩa',
    },
  },
]

const buildProducts = (prefix, categorySlug, categoryLabel, basePrice, location, condition = 'good') =>
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
      categorySlug,
    }
  })

export const DECOR_PRODUCTS_BY_CATEGORY = {
  'do-trang-tri': buildProducts('Bàn decor', 'do-trang-tri', 'Đồ trang trí', 750000, {
    province: 'Hà Nội',
    district: 'Hoàn Kiếm',
  }),
  'den-decor': buildProducts('Đèn decor', 'den-decor', 'Đèn decor', 450000, {
    province: 'Đà Nẵng',
    district: 'Sơn Trà',
  }, 'like_new'),
  'tranh-treo-tuong': buildProducts('Tranh treo tường', 'tranh-treo-tuong', 'Tranh treo tường', 600000, {
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
  }),
  'ke-decor': buildProducts('Kệ decor', 'ke-decor', 'Kệ decor', 900000, {
    province: 'Hải Phòng',
    district: 'Lê Chân',
  }, 'good'),
}
