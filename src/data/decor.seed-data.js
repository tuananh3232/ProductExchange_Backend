export const DECOR_CATEGORIES = [
  {
    name: 'Do trang tri',
    slug: 'do-trang-tri',
    description: 'Cac mon decor giup lam dep khong gian song.',
    icon: 'sparkles',
  },
  {
    name: 'Den decor',
    slug: 'den-decor',
    description: 'Den ban, den ngu va den trang tri cho phong.',
    icon: 'lamp',
  },
  {
    name: 'Tranh treo tuong',
    slug: 'tranh-treo-tuong',
    description: 'Tranh canvas, tranh nghe thuat va tranh toi gian.',
    icon: 'image',
  },
  {
    name: 'Ke decor',
    slug: 'ke-decor',
    description: 'Ke go, ke mini va ke trung bay do decor.',
    icon: 'shelf',
  },
]

export const DECOR_SHOPS = [
  {
    name: 'Decor House Ha Noi',
    slug: 'decor-house-ha-noi',
    description: 'Shop do decor tong hop cho phong khach, phong ngu va goc lam viec.',
    phone: '0901001001',
    email: 'ha-noi@decorhouse.example',
    address: {
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      detail: '12 Hang Gai',
    },
  },
  {
    name: 'Decor Light Da Nang',
    slug: 'decor-light-da-nang',
    description: 'Cua hang chuyen den decor, den ban va phu kien chieu sang trang tri.',
    phone: '0902002002',
    email: 'da-nang@decorhouse.example',
    address: {
      province: 'Da Nang',
      district: 'Son Tra',
      detail: '28 Tran Hung Dao',
    },
  },
  {
    name: 'Decor Art Sai Gon',
    slug: 'decor-art-sai-gon',
    description: 'Shop tranh treo tuong va ke decor cho khong gian hien dai.',
    phone: '0903003003',
    email: 'sai-gon@decorhouse.example',
    address: {
      province: 'TP. Ho Chi Minh',
      district: 'Quan 3',
      detail: '86 Nam Ky Khoi Nghia',
    },
  },
]

const imageFor = (shopSlug, productSlug) => ({
  url: `https://img.example.com/seed/${shopSlug}/${productSlug}.jpg`,
  publicId: `seed/${shopSlug}/${productSlug}`,
})

const buildProduct = ({
  title,
  slug,
  description,
  price,
  categorySlug,
  province,
  district,
  condition = 'good',
  stock = 1,
}) => ({
  title,
  description,
  price,
  stock,
  listingType: 'sell',
  condition,
  location: { province, district },
  categorySlug,
  images: [],
  imageSlug: slug,
})

export const DECOR_PRODUCTS_BY_SHOP = {
  'decor-house-ha-noi': [
    buildProduct({
      title: 'Binh gom trang tri phong khach',
      slug: 'binh-gom-trang-tri-phong-khach',
      description: 'Binh gom men mo cao 32cm, phu hop ban console va ke phong khach.',
      price: 650000,
      categorySlug: 'do-trang-tri',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      condition: 'like_new',
    }),
    buildProduct({
      title: 'Dong ho go treo tuong Bac Au',
      slug: 'dong-ho-go-treo-tuong-bac-au',
      description: 'Dong ho go phong cach Bac Au, mat so toi gian, may chay em.',
      price: 890000,
      categorySlug: 'do-trang-tri',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      condition: 'new',
    }),
    buildProduct({
      title: 'Den ngu de ban than go',
      slug: 'den-ngu-de-ban-than-go',
      description: 'Den ngu anh sang am, than go tu nhien va chup vai mau kem.',
      price: 520000,
      categorySlug: 'den-decor',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
    }),
    buildProduct({
      title: 'Ke treo tuong mini 3 tang',
      slug: 'ke-treo-tuong-mini-3-tang',
      description: 'Ke treo tuong nho gon cho sach, cay mini va phu kien decor.',
      price: 740000,
      categorySlug: 'ke-decor',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
    }),
  ],
  'decor-light-da-nang': [
    buildProduct({
      title: 'Den cay doc sach anh sang am',
      slug: 'den-cay-doc-sach-anh-sang-am',
      description: 'Den cay kim loai son tinh dien, co the dieu chinh huong sang.',
      price: 1250000,
      categorySlug: 'den-decor',
      province: 'Da Nang',
      district: 'Son Tra',
      condition: 'new',
    }),
    buildProduct({
      title: 'Den tha tran may tre',
      slug: 'den-tha-tran-may-tre',
      description: 'Den tha tran may tre thu cong, hop phong an va goc cafe tai nha.',
      price: 980000,
      categorySlug: 'den-decor',
      province: 'Da Nang',
      district: 'Son Tra',
      condition: 'like_new',
    }),
    buildProduct({
      title: 'Bo den LED trang tri ke TV',
      slug: 'bo-den-led-trang-tri-ke-tv',
      description: 'Bo LED day anh sang vang am, tao diem nhan cho ke TV va tu trung bay.',
      price: 390000,
      categorySlug: 'den-decor',
      province: 'Da Nang',
      district: 'Son Tra',
    }),
    buildProduct({
      title: 'Tuong decor ceramic trang',
      slug: 'tuong-decor-ceramic-trang',
      description: 'Tuong ceramic mau trang toi gian, dung trang tri ban lam viec.',
      price: 430000,
      categorySlug: 'do-trang-tri',
      province: 'Da Nang',
      district: 'Son Tra',
    }),
  ],
  'decor-art-sai-gon': [
    buildProduct({
      title: 'Tranh canvas la nhiet doi',
      slug: 'tranh-canvas-la-nhiet-doi',
      description: 'Tranh canvas chu de la nhiet doi, kich thuoc 60x80cm.',
      price: 720000,
      categorySlug: 'tranh-treo-tuong',
      province: 'TP. Ho Chi Minh',
      district: 'Quan 3',
      condition: 'new',
    }),
    buildProduct({
      title: 'Tranh toi gian tone den trang',
      slug: 'tranh-toi-gian-tone-den-trang',
      description: 'Tranh nghe thuat toi gian tone den trang, de phoi voi noi that hien dai.',
      price: 680000,
      categorySlug: 'tranh-treo-tuong',
      province: 'TP. Ho Chi Minh',
      district: 'Quan 3',
    }),
    buildProduct({
      title: 'Ke go dung tranh va sach',
      slug: 'ke-go-dung-tranh-va-sach',
      description: 'Ke go nho co chan sat, phu hop trung bay tranh, sach va binh hoa.',
      price: 1150000,
      categorySlug: 'ke-decor',
      province: 'TP. Ho Chi Minh',
      district: 'Quan 3',
      condition: 'like_new',
    }),
    buildProduct({
      title: 'Ke module trang tri phong lam viec',
      slug: 'ke-module-trang-tri-phong-lam-viec',
      description: 'Ke module co the ghep linh hoat cho goc lam viec va studio.',
      price: 1490000,
      categorySlug: 'ke-decor',
      province: 'TP. Ho Chi Minh',
      district: 'Quan 3',
    }),
  ],
}

export const DECOR_PRODUCTS_BY_CATEGORY = Object.entries(DECOR_PRODUCTS_BY_SHOP).reduce(
  (productsByCategory, [shopSlug, products]) => {
    for (const product of products) {
      const productWithImage = {
        ...product,
        images: [imageFor(shopSlug, product.imageSlug)],
      }
      delete productWithImage.imageSlug

      productsByCategory[product.categorySlug] = productsByCategory[product.categorySlug] || []
      productsByCategory[product.categorySlug].push(productWithImage)
    }

    return productsByCategory
  },
  {}
)
