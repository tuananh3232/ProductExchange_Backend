import mongoose from 'mongoose';
import { env } from '../src/configs/env.config.js';
import { connectDB, disconnectDB } from '../src/configs/database.config.js';
import Cart from '../src/models/cart.model.js';
import Category from '../src/models/category.model.js';
import Conversation, { CONVERSATION_TYPES } from '../src/models/conversation.model.js';
import Message, { MESSAGE_TYPES } from '../src/models/message.model.js';
import Notification from '../src/models/notification.model.js';
import Order from '../src/models/order.model.js';
import Payment from '../src/models/payment.model.js';
import Permission from '../src/models/permission.model.js';
import Product, { PRODUCT_OWNER_TYPES } from '../src/models/product.model.js';
import Role from '../src/models/role.model.js';
import Shop from '../src/models/shop.model.js';
import ShopInvitation from '../src/models/shop-invitation.model.js';
import User from '../src/models/user.model.js';
import UserWallet from '../src/models/user-wallet.model.js';
import UserWalletTopup from '../src/models/user-wallet-topup.model.js';
import UserWalletTransaction from '../src/models/user-wallet-transaction.model.js';
import UserWalletWithdrawal from '../src/models/user-wallet-withdrawal.model.js';
import Wallet from '../src/models/wallet.model.js';
import WalletTransaction from '../src/models/wallet-transaction.model.js';
import WithdrawalRequest from '../src/models/withdrawal-request.model.js';
import { COLOR_TONES, PRODUCT_STYLES, ROOM_TYPES } from '../src/constants/combo.constant.js';
import {
  INVITATION_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  SHOP_STATUS,
  TOPUP_STATUS,
  USER_WALLET_TRANSACTION_TYPE,
  WALLET_TRANSACTION_STATUS,
  WALLET_TRANSACTION_TYPE,
  WITHDRAWAL_STATUS,
} from '../src/constants/status.constant.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TARGET_TYPES,
  NOTIFICATION_TYPES,
} from '../src/constants/notification.constant.js';
import PERMISSIONS from '../src/constants/permission.constant.js';
import { ensureRbacSeedData } from '../src/services/rbac/rbac-seed.service.js';

const PASSWORD = '123456';
const ALLOWED_DATABASE_NAMES = new Set(['productexchange', 'product_dev', 'product_local', 'product_test']);
const BLOCKED_DATABASE_NAMES = new Set(['prod', 'production']);
const now = new Date();

const categories = [
  ['Furniture', 'furniture', 'sofa'],
  ['Wall Decor', 'wall-decor', 'image'],
  ['Lighting', 'lighting', 'lamp'],
  ['Home Textile', 'home-textile', 'rug'],
  ['Plant & Vase', 'plant-vase', 'flower'],
  ['Storage & Organizer', 'storage-organizer', 'box'],
  ['Kitchen Decor', 'kitchen-decor', 'utensils'],
  ['Bedroom Decor', 'bedroom-decor', 'bed'],
  ['Living Room Decor', 'living-room-decor', 'sofa'],
  ['Bathroom Decor', 'bathroom-decor', 'bath'],
  ['Office Decor', 'office-decor', 'briefcase'],
  ['Outdoor Decor', 'outdoor-decor', 'sun'],
  ['Candle & Aroma', 'candle-aroma', 'flame'],
  ['Handmade Decor', 'handmade-decor', 'hand'],
  ['Seasonal Decor', 'seasonal-decor', 'calendar'],
  ['Kids Room Decor', 'kids-room-decor', 'baby'],
  ['Pet Decor', 'pet-decor', 'paw'],
  ['Art & Collectibles', 'art-collectibles', 'palette'],
  ['Mirror & Glass Decor', 'mirror-glass-decor', 'circle'],
  ['Party & Event Decor', 'party-event-decor', 'party'],
];

const productNamesByCategory = {
  Furniture: [
    'Bàn trà gỗ tối giản',
    'Ghế sofa đơn phòng khách',
    'Kệ TV hiện đại',
    'Bàn làm việc gỗ công nghiệp',
    'Ghế mây thư giãn',
    'Tủ đầu giường mini',
    'Kệ sách đứng 5 tầng',
    'Bàn console trang trí',
    'Ghế đôn bọc vải',
    'Tủ giày phong cách Bắc Âu',
  ],
  'Wall Decor': [
    'Tranh canvas phong cảnh',
    'Tranh abstract treo tường',
    'Đồng hồ treo tường decor',
    'Gương tròn viền gỗ',
    'Khung ảnh treo tường',
    'Bộ poster phong cách vintage',
    'Kệ treo tường mini',
    'Macrame treo tường handmade',
    'Decal dán tường hoa lá',
    'Bảng quote trang trí',
  ],
  Lighting: [
    'Đèn bàn làm việc hiện đại',
    'Đèn ngủ ánh sáng vàng',
    'Đèn cây phòng khách',
    'Đèn thả trần decor',
    'Đèn LED dây trang trí',
    'Đèn mây tre handmade',
    'Đèn tường phong cách industrial',
    'Đèn nến điện tử',
    'Đèn cảm ứng đầu giường',
    'Đèn trang trí hình cầu',
  ],
  'Home Textile': [
    'Thảm lông phòng ngủ',
    'Thảm vintage phòng khách',
    'Rèm cửa linen',
    'Rèm voan trắng',
    'Gối tựa sofa màu be',
    'Gối ôm decor',
    'Khăn trải bàn caro',
    'Chăn sofa dệt len',
    'Vỏ gối họa tiết Bohemian',
    'Thảm chùi chân decor',
  ],
  'Plant & Vase': [
    'Cây giả monstera',
    'Cây lưỡi hổ mini',
    'Cây sen đá để bàn',
    'Chậu cây xi măng nhỏ',
    'Bình hoa thủy tinh trong suốt',
    'Bình gốm trắng decor',
    'Hoa khô lavender',
    'Cành lá giả eucalyptus',
    'Chậu cây treo ban công',
    'Bộ bình hoa phong cách Nordic',
  ],
  'Storage & Organizer': [
    'Hộp đựng đồ vải canvas',
    'Giỏ mây đựng đồ',
    'Khay gỗ để bàn',
    'Kệ góc nhà tắm',
    'Hộp nhựa trong suốt',
    'Kệ để gia vị nhà bếp',
    'Khay đựng trang sức',
    'Giá treo chìa khóa',
    'Tủ ngăn kéo mini',
    'Hộp đựng mỹ phẩm để bàn',
  ],
  'Kitchen Decor': [
    'Bộ lọ gia vị thủy tinh',
    'Khay gỗ đựng ly',
    'Kệ bếp mini 2 tầng',
    'Ly gốm phong cách Hàn Quốc',
    'Đĩa decor ceramic',
    'Bình nước thủy tinh',
    'Khăn trải bàn ăn',
    'Giỏ đựng trái cây bằng mây',
    'Kệ treo dụng cụ bếp',
    'Bình cắm hoa bàn ăn',
  ],
  'Bedroom Decor': [
    'Đèn ngủ đầu giường',
    'Tủ đầu giường mini',
    'Tranh treo phòng ngủ',
    'Gương đứng toàn thân',
    'Thảm lông cạnh giường',
    'Bộ ga gối màu pastel',
    'Kệ sách nhỏ cạnh giường',
    'Nến thơm thư giãn',
    'Rèm cửa chống nắng',
    'Đồng hồ báo thức decor',
  ],
  'Living Room Decor': [
    'Bàn trà mặt kính',
    'Sofa vải màu xám',
    'Thảm phòng khách hiện đại',
    'Tranh canvas treo sofa',
    'Đèn cây đứng phòng khách',
    'Kệ TV gỗ trắng',
    'Gối tựa sofa họa tiết',
    'Bình hoa đặt bàn trà',
    'Đồng hồ treo tường lớn',
    'Tượng decor để kệ',
  ],
  'Bathroom Decor': [
    'Kệ nhà tắm inox',
    'Gương phòng tắm viền đen',
    'Khay đựng xà phòng gốm',
    'Bộ chai chiết dầu gội',
    'Thảm chống trượt nhà tắm',
    'Giỏ mây đựng khăn',
    'Kệ góc dán tường',
    'Hộp đựng bàn chải',
    'Nến thơm phòng tắm',
    'Rèm nhà tắm chống nước',
  ],
  'Office Decor': [
    'Đèn bàn làm việc',
    'Kệ laptop gỗ',
    'Khay đựng bút để bàn',
    'Đồng hồ mini để bàn',
    'Cây xanh mini để bàn',
    'Bảng ghi chú gỗ',
    'Kệ sách để bàn',
    'Lót chuột da decor',
    'Giá đỡ điện thoại',
    'Tượng decor bàn làm việc',
  ],
  'Outdoor Decor': [
    'Bàn ghế sân vườn',
    'Đèn năng lượng mặt trời',
    'Chậu cây ngoài trời',
    'Ghế xếp ban công',
    'Đèn dây trang trí ban công',
    'Kệ cây cảnh ngoài trời',
    'Thảm ban công chống nước',
    'Xích đu sân vườn',
    'Tượng trang trí sân vườn',
    'Ô che nắng ban công',
  ],
  'Candle & Aroma': [
    'Nến thơm hương vanilla',
    'Nến thơm hương lavender',
    'Máy khuếch tán tinh dầu',
    'Tinh dầu sả chanh',
    'Tinh dầu bạc hà',
    'Bộ que khuếch tán hương',
    'Nến tealight decor',
    'Đèn xông tinh dầu',
    'Sáp thơm phòng ngủ',
    'Bình tinh dầu treo xe',
  ],
  'Handmade Decor': [
    'Macrame treo tường',
    'Giỏ mây handmade',
    'Bình hoa đan len',
    'Tranh thêu tay',
    'Lót ly handmade',
    'Đèn mây tre thủ công',
    'Tượng đất sét mini',
    'Khung ảnh gỗ handmade',
    'Chậu cây vẽ tay',
    'Dây treo ảnh handmade',
  ],
  'Seasonal Decor': [
    'Cây thông Noel mini',
    'Dây đèn Noel',
    'Vòng nguyệt quế treo cửa',
    'Bao lì xì trang trí Tết',
    'Đèn lồng Tết',
    'Hoa mai giả decor',
    'Hoa đào giả decor',
    'Bí ngô Halloween decor',
    'Backdrop sinh nhật',
    'Dây treo trang trí tiệc',
  ],
  'Kids Room Decor': [
    'Đèn ngủ hình thú',
    'Thảm chơi cho bé',
    'Tranh treo tường hoạt hình',
    'Kệ đồ chơi mini',
    'Gối ôm hình thú',
    'Rèm cửa phòng trẻ em',
    'Bảng chữ cái decor',
    'Đồng hồ treo tường trẻ em',
    'Lều vải mini trong phòng',
    'Hộp đựng đồ chơi',
  ],
  'Pet Decor': [
    'Giường ngủ cho mèo',
    'Nhà gỗ cho thú cưng',
    'Kệ leo trèo cho mèo',
    'Bát ăn decor cho thú cưng',
    'Thảm nằm cho chó mèo',
    'Lều vải mini cho thú cưng',
    'Khay đựng đồ thú cưng',
    'Bảng tên thú cưng decor',
    'Sofa mini cho chó mèo',
    'Tủ đựng phụ kiện thú cưng',
  ],
  'Art & Collectibles': [
    'Tượng decor nghệ thuật',
    'Mô hình nhà mini',
    'Tượng gốm trừu tượng',
    'Bộ figure trang trí',
    'Đĩa sứ trang trí',
    'Tranh sơn dầu mini',
    'Bình gốm nghệ thuật',
    'Mô hình xe cổ decor',
    'Tượng động vật bằng gỗ',
    'Bộ sưu tập khung ảnh cổ điển',
  ],
  'Mirror & Glass Decor': [
    'Gương tròn viền vàng',
    'Gương đứng toàn thân',
    'Gương oval treo tường',
    'Gương decor phong cách vintage',
    'Gương viền mây tre',
    'Bình thủy tinh trong suốt',
    'Lọ thủy tinh cắm hoa',
    'Khay kính trang trí',
    'Hộp kính đựng trang sức',
    'Đèn thủy tinh decor',
  ],
  'Party & Event Decor': [
    'Backdrop sinh nhật',
    'Bóng bay trang trí',
    'Dây treo chữ Happy Birthday',
    'Đèn LED tiệc',
    'Khăn trải bàn tiệc',
    'Cổng hoa giả',
    'Nến sinh nhật decor',
    'Standee trang trí sự kiện',
    'Hoa giấy trang trí',
    'Bộ phụ kiện chụp ảnh tiệc',
  ],
};

const modelsToClear = [
  Message,
  Conversation,
  Notification,
  UserWalletWithdrawal,
  UserWalletTransaction,
  UserWalletTopup,
  UserWallet,
  WithdrawalRequest,
  WalletTransaction,
  Wallet,
  Payment,
  Order,
  Cart,
  Product,
  ShopInvitation,
  Shop,
  Category,
  User,
  Role,
  Permission,
];

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const seededPrice = (index) => 50000 + ((index * 137000) % 4950000);
const seededStock = (index) => 10 + (index % 41);

const decorRoleForCategory = (categoryName) => {
  if (categoryName === 'Furniture') return 'main_item';
  if (categoryName === 'Lighting') return 'lighting';
  if (categoryName === 'Wall Decor') return 'wall_decor';
  if (categoryName === 'Home Textile') return 'textile';
  if (categoryName === 'Candle & Aroma') return 'fragrance';
  return 'accent_item';
};

const assertSafeEnvironment = () => {
  const nodeEnv = process.env.NODE_ENV || env.nodeEnv || 'development';
  if (nodeEnv === 'production') {
    throw new Error('Seed is blocked in production.');
  }

  if (process.env.ALLOW_SEED_RESET !== 'true') {
    throw new Error('Set ALLOW_SEED_RESET=true to allow deleting existing seed data.');
  }
};

const maskMongoUri = (uri) => {
  if (!uri) return '';

  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:\s/@]+:)([^@\s]+)(@)/i, '$1***$3');
  }
};

const assertSafeDatabaseName = () => {
  const dbName = mongoose.connection.name;
  const lowerName = dbName.toLowerCase();
  if (BLOCKED_DATABASE_NAMES.has(lowerName)) {
    throw new Error(`Seed is blocked because database name is unsafe: ${dbName}`);
  }
  if (!ALLOWED_DATABASE_NAMES.has(lowerName)) {
    throw new Error(
      `Seed is only allowed for these databases: ${Array.from(ALLOWED_DATABASE_NAMES).join(', ')}. Current database: ${dbName}`
    );
  }
  return dbName;
};

const clearDatabase = async () => {
  const dbName = assertSafeDatabaseName();
  const collectionNames = modelsToClear.map((model) => model.collection.name);
  const nodeEnv = process.env.NODE_ENV || env.nodeEnv || 'development';
  const mongoUri = env.mongodb.uri || process.env.MONGODB_URI || '';

  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`Database: ${dbName}`);
  console.log(`MONGO_URI: ${maskMongoUri(mongoUri)}`);
  console.log(`Collections to clear: ${collectionNames.join(', ')}`);

  const deleted = {};
  for (const model of modelsToClear) {
    const result = await model.deleteMany({});
    deleted[model.collection.name] = result.deletedCount || 0;
  }

  return deleted;
};

const createUsers = async () => {
  const base = {
    password: PASSWORD,
    isVerified: true,
    emailVerifiedAt: now,
    isActive: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
  };

  const kycApproved = (name, index) => ({
    fullName: name,
    idNumber: `SEED${String(index).padStart(8, '0')}`,
    frontImage: { url: `https://picsum.photos/seed/kyc-front-${index}/600/400`, publicId: `seed/kyc/front-${index}` },
    backImage: { url: `https://picsum.photos/seed/kyc-back-${index}/600/400`, publicId: `seed/kyc/back-${index}` },
    status: 'approved',
    submittedAt: now,
    reviewedAt: now,
  });

  const docs = [
    {
      ...base,
      email: 'admin@gmail.com',
      name: 'Admin',
      roles: ['admin'],
      address: { province: 'Ha Noi', district: 'Hoan Kiem', detail: 'Seed Admin Office' },
    },
    ...Array.from({ length: 7 }, (_, index) => ({
      ...base,
      email: `shop${index + 1}@gmail.com`,
      name: `Shop Owner ${index + 1}`,
      roles: ['member', 'shop_owner'],
      phone: `09010010${String(index + 1).padStart(2, '0')}`,
      address: { province: 'Ha Noi', district: `District ${index + 1}`, detail: `${index + 10} Decor Street` },
      kyc: kycApproved(`Shop Owner ${index + 1}`, index + 1),
    })),
    ...Array.from({ length: 7 }, (_, index) => ({
      ...base,
      email: `staff${index + 1}@gmail.com`,
      name: `Staff ${index + 1}`,
      roles: ['member', 'staff'],
      phone: `09020020${String(index + 1).padStart(2, '0')}`,
      address: { province: 'Da Nang', district: `District ${index + 1}`, detail: `${index + 20} Staff Street` },
    })),
    ...Array.from({ length: 5 }, (_, index) => ({
      ...base,
      email: `seller${index + 1}@gmail.com`,
      name: `Seller ${index + 1}`,
      roles: ['member', 'seller'],
      phone: `09030030${String(index + 1).padStart(2, '0')}`,
      address: { province: 'Ho Chi Minh', district: `District ${index + 1}`, detail: `${index + 30} Seller Street` },
      kyc: kycApproved(`Seller ${index + 1}`, index + 101),
    })),
    {
      ...base,
      email: 'member1@gmail.com',
      name: 'Member 1',
      roles: ['member'],
      phone: '0904004001',
      address: { province: 'Ha Noi', district: 'Ba Dinh', detail: '101 Member Street' },
    },
    {
      ...base,
      email: 'member2@gmail.com',
      name: 'Member 2',
      roles: ['member'],
      phone: '0904004002',
      address: { province: 'Ho Chi Minh', district: 'District 7', detail: '202 Member Street' },
    },
  ];

  const users = [];
  for (const doc of docs) {
    users.push(await User.create(doc));
  }

  return {
    users,
    byEmail: Object.fromEntries(users.map((user) => [user.email, user])),
  };
};

const createCategories = async () =>
  Category.insertMany(
    categories.map(([name, slug, icon]) => ({
      name,
      slug,
      icon,
      description: `Danh mục ${name} cho dữ liệu decor mẫu.`,
      isActive: true,
    }))
  );

const createShops = async (usersByEmail) => {
  const staffPermissions = [
    PERMISSIONS.SHOP_READ,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_UPDATE,
    PERMISSIONS.ORDER_READ,
    PERMISSIONS.ORDER_CONFIRM,
  ];

  const shops = await Shop.insertMany(
    Array.from({ length: 7 }, (_, index) => {
      const number = index + 1;
      const owner = usersByEmail[`shop${number}@gmail.com`];
      const staff = usersByEmail[`staff${number}@gmail.com`];
      return {
        name: `Decor Shop ${number}`,
        slug: `decor-shop-${number}`,
        description: `Decor Shop ${number} chuyên sản phẩm trang trí nhà cửa và không gian sống.`,
        phone: `091${String(number).padStart(7, '0')}`,
        email: `decor-shop-${number}@example.com`,
        address: {
          province: number % 2 === 0 ? 'Ho Chi Minh' : 'Ha Noi',
          district: `District ${number}`,
          detail: `${number * 11} Decor Avenue`,
        },
        logo: {
          url: `https://picsum.photos/seed/decor-shop-${number}/300/300`,
          publicId: `seed/shops/decor-shop-${number}`,
        },
        owner: owner._id,
        staff: [staff._id],
        staffPermissions: [
          {
            staffUser: staff._id,
            permissions: staffPermissions,
            updatedBy: owner._id,
            updatedAt: now,
          },
        ],
        status: SHOP_STATUS.ACTIVE,
        isActive: true,
      };
    })
  );

  await ShopInvitation.insertMany(
    shops.map((shop, index) => {
      const number = index + 1;
      return {
        shop: shop._id,
        invitee: usersByEmail[`staff${number}@gmail.com`]._id,
        inviter: usersByEmail[`shop${number}@gmail.com`]._id,
        role: 'STAFF',
        permissions: staffPermissions,
        status: INVITATION_STATUS.ACCEPTED,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        rejectionReason: '',
      };
    })
  );

  return shops;
};

const createProducts = async ({ categoryDocs, shops, usersByEmail }) => {
  const categoryByName = Object.fromEntries(categoryDocs.map((category) => [category.name, category]));
  const shopOwners = Array.from({ length: 7 }, (_, index) => usersByEmail[`shop${index + 1}@gmail.com`]);
  const sellers = Array.from({ length: 5 }, (_, index) => usersByEmail[`seller${index + 1}@gmail.com`]);
  const products = [];
  let globalIndex = 0;

  for (const [categoryName, names] of Object.entries(productNamesByCategory)) {
    const category = categoryByName[categoryName];
    for (const name of names) {
      const isShopProduct = globalIndex < 140;
      const ownerIndex = isShopProduct ? globalIndex % shops.length : (globalIndex - 140) % sellers.length;
      const shop = isShopProduct ? shops[ownerIndex] : null;
      const owner = isShopProduct ? shopOwners[ownerIndex] : sellers[ownerIndex];
      const seller = isShopProduct ? null : sellers[ownerIndex];
      const slug = slugify(`${categoryName}-${name}`);

      products.push({
        title: name,
        description: `${name} phù hợp để hoàn thiện không gian decor hiện đại, dễ phối cùng nhiều phong cách nội thất.`,
        price: seededPrice(globalIndex),
        stock: seededStock(globalIndex),
        listingType: 'sell',
        condition: globalIndex % 3 === 0 ? 'new' : 'like_new',
        images: [
          {
            url: `https://picsum.photos/seed/${slug}/600/600`,
            publicId: `seed/products/${slug}`,
          },
        ],
        category: category._id,
        owner: owner._id,
        ownerType: isShopProduct ? PRODUCT_OWNER_TYPES.SHOP : PRODUCT_OWNER_TYPES.SELLER,
        shop: shop?._id || null,
        seller: seller?._id || null,
        location: {
          province: isShopProduct ? shop.address.province : owner.address.province,
          district: isShopProduct ? shop.address.district : owner.address.district,
        },
        status: PRODUCT_STATUS.AVAILABLE,
        views: globalIndex * 3,
        isActive: true,
        style: PRODUCT_STYLES[globalIndex % PRODUCT_STYLES.length],
        roomType: ROOM_TYPES[globalIndex % ROOM_TYPES.length],
        colorTone: COLOR_TONES[globalIndex % COLOR_TONES.length],
        decorRole: decorRoleForCategory(categoryName),
        comboPriority: 1 + (globalIndex % 5),
      });

      globalIndex += 1;
    }
  }

  return Product.insertMany(products);
};

const createCarts = async (usersByEmail, products) =>
  Cart.insertMany([
    {
      user: usersByEmail['member1@gmail.com']._id,
      items: products.slice(0, 3).map((product) => ({
        product: product._id,
        quantity: 1,
        unitPrice: product.price,
      })),
    },
    {
      user: usersByEmail['member2@gmail.com']._id,
      items: products.slice(3, 5).map((product) => ({
        product: product._id,
        quantity: 1,
        unitPrice: product.price,
      })),
    },
  ]);

const orderScenarios = [
  [ORDER_STATUS.PENDING, PAYMENT_STATUS.UNPAID, 'pending unpaid'],
  [ORDER_STATUS.PENDING, PAYMENT_STATUS.PAID, 'pending paid'],
  [ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PAID, 'confirmed paid'],
  [ORDER_STATUS.PROCESSING, PAYMENT_STATUS.PAID, 'processing paid'],
  [ORDER_STATUS.SHIPPED, PAYMENT_STATUS.PAID, 'shipped paid'],
  [ORDER_STATUS.DELIVERED, PAYMENT_STATUS.PAID, 'delivered paid'],
  [ORDER_STATUS.CANCELLED, PAYMENT_STATUS.UNPAID, 'cancelled unpaid'],
];

const createOrdersAndPayments = async (usersByEmail, products) => {
  const orders = [];
  const payments = [];
  const orderProducts = products.slice(20, 27);

  for (const [index, product] of orderProducts.entries()) {
    const [status, paymentStatus, note] = orderScenarios[index];
    const buyer = usersByEmail[index % 2 === 0 ? 'member1@gmail.com' : 'member2@gmail.com'];
    const quantity = index % 3 === 0 ? 2 : 1;
    const transactionRef = `SEED_ORDER_${index + 1}_${Date.now()}`;
    const order = await Order.create({
      buyer: buyer._id,
      shop: product.shop || null,
      seller: product.seller || null,
      product: product._id,
      quantity,
      unitPrice: product.price,
      totalAmount: product.price * quantity,
      status,
      shippingAddress: buyer.address,
      note: `Seed order ${note}`,
      paymentStatus,
      paymentMethod: paymentStatus === PAYMENT_STATUS.PAID ? 'payos' : '',
      paymentProvider: paymentStatus === PAYMENT_STATUS.PAID ? 'payos' : '',
      paymentRef: paymentStatus === PAYMENT_STATUS.PAID ? transactionRef : '',
      paidAt: paymentStatus === PAYMENT_STATUS.PAID ? now : null,
      history: [
        { status: ORDER_STATUS.PENDING, note: 'Seed order created', updatedBy: buyer._id, updatedAt: now },
        { status, note: `Seed status: ${status}`, updatedBy: buyer._id, updatedAt: now },
      ],
      isActive: true,
    });

    orders.push(order);

    if (paymentStatus === PAYMENT_STATUS.PAID) {
      payments.push(
        await Payment.create({
          order: order._id,
          buyer: buyer._id,
          amount: order.totalAmount,
          provider: 'payos',
          method: 'payos',
          status: PAYMENT_STATUS.PAID,
          transactionRef,
          responseCode: '00',
          rawCallbackData: { seed: true, scenario: note },
          paidAt: now,
        })
      );
    }
  }

  return { orders, payments };
};

const createWallets = async ({ shops, usersByEmail, deliveredOrder }) => {
  const wallets = await Wallet.insertMany(
    shops.map((shop, index) => {
      const hasDeliveredOrder = deliveredOrder?.shop?.toString() === shop._id.toString();
      const earned = hasDeliveredOrder ? deliveredOrder.totalAmount : 0;
      return {
        shop: shop._id,
        balance: earned + index * 100000,
        pendingBalance: index * 10000,
        totalEarned: earned + index * 100000,
        totalWithdrawn: 0,
        isActive: true,
      };
    })
  );

  const transactions = [];
  if (deliveredOrder?.shop) {
    const wallet = wallets.find((item) => item.shop.toString() === deliveredOrder.shop.toString());
    transactions.push(
      await WalletTransaction.create({
        wallet: wallet._id,
        shop: wallet.shop,
        order: deliveredOrder._id,
        type: WALLET_TRANSACTION_TYPE.CREDIT,
        grossAmount: deliveredOrder.totalAmount,
        platformFee: 0,
        netAmount: deliveredOrder.totalAmount,
        status: WALLET_TRANSACTION_STATUS.COMPLETED,
        description: 'Payout for delivered order',
        metadata: { seed: true },
      })
    );
  }

  const withdrawals = await WithdrawalRequest.insertMany([
    {
      shop: shops[0]._id,
      wallet: wallets[0]._id,
      requestedBy: usersByEmail['shop1@gmail.com']._id,
      amount: 100000,
      bankInfo: {
        bankName: 'VCB',
        accountNumber: '0123456789',
        accountName: 'SHOP OWNER 1',
        bankBranch: 'Ha Noi',
      },
      status: WITHDRAWAL_STATUS.PENDING,
      note: 'Shop withdrawal',
    },
  ]);

  return { wallets, transactions, withdrawals };
};

const createUserWallets = async ({ usersByEmail, paidOrder }) => {
  const member1 = usersByEmail['member1@gmail.com'];
  const member2 = usersByEmail['member2@gmail.com'];
  const wallets = await UserWallet.insertMany([
    {
      user: member1._id,
      balance: 10000000,
      totalTopUp: 12000000,
      totalSpent: paidOrder?.buyer?.toString() === member1._id.toString() ? paidOrder.totalAmount : 0,
      pendingBalance: 0,
      totalWithdrawn: 500000,
      isActive: true,
    },
    {
      user: member2._id,
      balance: 10000,
      totalTopUp: 50000,
      totalSpent: 40000,
      pendingBalance: 0,
      totalWithdrawn: 0,
      isActive: true,
    },
  ]);

  const wallet1 = wallets[0];
  const topup = await UserWalletTopup.create({
    user: member1._id,
    wallet: wallet1._id,
    amount: 12000000,
    status: TOPUP_STATUS.COMPLETED,
    transactionRef: 'TOPUP_MEMBER1_001',
    orderCode: 8603001,
    provider: 'payos',
    checkoutUrl: 'https://payos.vn/seed/topup/member1',
    rawCallbackData: { seed: true },
    completedAt: now,
  });

  const transactions = await UserWalletTransaction.insertMany([
    {
      wallet: wallet1._id,
      user: member1._id,
      topup: topup._id,
      type: USER_WALLET_TRANSACTION_TYPE.TOPUP,
      amount: topup.amount,
      balanceBefore: 0,
      balanceAfter: topup.amount,
      status: WALLET_TRANSACTION_STATUS.COMPLETED,
      description: 'Seed completed topup',
    },
    {
      wallet: wallet1._id,
      user: member1._id,
      order: paidOrder?._id || null,
      type: USER_WALLET_TRANSACTION_TYPE.PAYMENT,
      amount: paidOrder?.totalAmount || 0,
      balanceBefore: topup.amount,
      balanceAfter: topup.amount - (paidOrder?.totalAmount || 0),
      status: WALLET_TRANSACTION_STATUS.COMPLETED,
      description: 'Seed wallet payment',
    },
  ]);

  const withdrawals = await UserWalletWithdrawal.insertMany([
    {
      user: member1._id,
      wallet: wallet1._id,
      amount: 500000,
      bankInfo: {
        bankName: 'VCB',
        accountNumber: '0987654321',
        accountName: 'MEMBER 1',
        bankBranch: 'Ha Noi',
      },
      status: WITHDRAWAL_STATUS.COMPLETED,
      note: 'Seed completed user withdrawal',
      completedAt: now,
    },
  ]);

  return { wallets, topups: [topup], transactions, withdrawals };
};

const createNotifications = async ({ usersByEmail, shops, products, orders, payments }) =>
  Notification.insertMany([
    {
      recipient: usersByEmail['admin@gmail.com']._id,
      type: NOTIFICATION_TYPES.KYC_SUBMITTED,
      title: 'Có hồ sơ KYC mới',
      message: 'Seller 1 đã gửi hồ sơ KYC mẫu.',
      targetType: NOTIFICATION_TARGET_TYPES.USER,
      targetId: usersByEmail['seller1@gmail.com']._id,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.IN_APP],
      isRead: false,
    },
    {
      recipient: usersByEmail['shop1@gmail.com']._id,
      sender: usersByEmail['admin@gmail.com']._id,
      type: NOTIFICATION_TYPES.SHOP_APPROVED,
      title: 'Shop đã được duyệt',
      message: 'Decor Shop 1 đã sẵn sàng bán hàng.',
      targetType: NOTIFICATION_TARGET_TYPES.SHOP,
      targetId: shops[0]._id,
      isRead: true,
      readAt: now,
    },
    {
      recipient: usersByEmail['staff1@gmail.com']._id,
      sender: usersByEmail['shop1@gmail.com']._id,
      type: NOTIFICATION_TYPES.SHOP_STAFF_INVITED,
      title: 'Bạn đã được thêm vào shop',
      message: 'Bạn có thể quản lý sản phẩm và đơn hàng mẫu.',
      targetType: NOTIFICATION_TARGET_TYPES.SHOP,
      targetId: shops[0]._id,
      isRead: false,
    },
    {
      recipient: usersByEmail['seller1@gmail.com']._id,
      type: NOTIFICATION_TYPES.PRODUCT_APPROVED,
      title: 'Sản phẩm đã hiển thị',
      message: 'Sản phẩm seller mẫu đã được duyệt.',
      targetType: NOTIFICATION_TARGET_TYPES.PRODUCT,
      targetId: products[145]._id,
      isRead: true,
      readAt: now,
    },
    {
      recipient: usersByEmail['member1@gmail.com']._id,
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      title: 'Đơn hàng đã được tạo',
      message: 'Đơn hàng mẫu của bạn đã được ghi nhận.',
      targetType: NOTIFICATION_TARGET_TYPES.ORDER,
      targetId: orders[0]._id,
      isRead: false,
    },
    {
      recipient: usersByEmail['member2@gmail.com']._id,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: 'Thanh toán thành công',
      message: 'Thanh toán mẫu đã hoàn tất.',
      targetType: NOTIFICATION_TARGET_TYPES.PAYMENT,
      targetId: payments[0]?._id || null,
      isRead: true,
      readAt: now,
    },
  ]);

const createConversations = async ({ usersByEmail, shops }) => {
  const member1 = usersByEmail['member1@gmail.com'];
  const seller1 = usersByEmail['seller1@gmail.com'];
  const shop1 = shops[0];
  const directParticipantIds = [member1._id, seller1._id].map((id) => id.toString()).sort();

  const directConversation = await Conversation.create({
    type: CONVERSATION_TYPES.DIRECT,
    participants: [member1._id, seller1._id],
    participantKey: directParticipantIds.join(':'),
    isActive: true,
  });

  const shopConversation = await Conversation.create({
    type: CONVERSATION_TYPES.SHOP,
    participants: [member1._id, shop1.owner],
    shopId: shop1._id,
    customerId: member1._id,
    shopCustomerKey: `${shop1._id}:${member1._id}`,
    isActive: true,
  });

  const messages = await Message.insertMany([
    {
      conversationId: directConversation._id,
      senderId: member1._id,
      content: 'Sản phẩm này còn hàng không?',
      messageType: MESSAGE_TYPES.TEXT,
      readBy: [{ userId: member1._id, readAt: now }],
    },
    {
      conversationId: directConversation._id,
      senderId: seller1._id,
      content: 'Còn hàng, mình có thể giao trong hôm nay.',
      messageType: MESSAGE_TYPES.TEXT,
      readBy: [{ userId: seller1._id, readAt: now }],
    },
    {
      conversationId: shopConversation._id,
      senderId: member1._id,
      content: 'Shop có thể tư vấn combo phòng khách không?',
      messageType: MESSAGE_TYPES.TEXT,
      readBy: [{ userId: member1._id, readAt: now }],
    },
    {
      conversationId: shopConversation._id,
      senderId: shop1.owner,
      content: '',
      messageType: MESSAGE_TYPES.IMAGE,
      attachments: [
        {
          url: 'https://picsum.photos/seed/shop-combo-sample/800/600',
          publicId: 'seed/messages/shop-combo-sample',
          name: 'combo-phong-khach.jpg',
          mimeType: 'image/jpeg',
          size: 128000,
        },
      ],
      readBy: [{ userId: shop1.owner, readAt: now }],
    },
  ]);

  const lastDirectMessage = messages[1];
  const lastShopMessage = messages[3];

  await Conversation.findByIdAndUpdate(directConversation._id, {
    lastMessage: {
      messageId: lastDirectMessage._id,
      senderId: lastDirectMessage.senderId,
      content: lastDirectMessage.content,
      messageType: lastDirectMessage.messageType,
      sentAt: lastDirectMessage.createdAt,
    },
    lastMessageAt: lastDirectMessage.createdAt,
  });

  await Conversation.findByIdAndUpdate(shopConversation._id, {
    lastMessage: {
      messageId: lastShopMessage._id,
      senderId: lastShopMessage.senderId,
      content: '[image]',
      messageType: lastShopMessage.messageType,
      sentAt: lastShopMessage.createdAt,
    },
    lastMessageAt: lastShopMessage.createdAt,
  });

  return { conversations: [directConversation, shopConversation], messages };
};

const printSummary = ({ dbName, deleted, created, users }) => {
  console.log('\nDeleted documents:');
  for (const [collection, count] of Object.entries(deleted)) {
    console.log(`- ${collection}: ${count}`);
  }

  console.log('\nCreated documents:');
  for (const [collection, count] of Object.entries(created)) {
    console.log(`- ${collection}: ${count}`);
  }

  console.log(`\nDatabase: ${dbName}`);
  console.log('\nTest accounts:');
  for (const user of users) {
    console.log(`${user.email} / ${PASSWORD}`);
  }
};

const main = async () => {
  assertSafeEnvironment();

  if (!env.mongodb.uri) {
    throw new Error('MONGODB_URI is missing.');
  }

  await connectDB();

  try {
    const dbName = assertSafeDatabaseName();
    const deleted = await clearDatabase();

    await ensureRbacSeedData();
    const { users, byEmail: usersByEmail } = await createUsers();
    const categoryDocs = await createCategories();
    const shops = await createShops(usersByEmail);
    const products = await createProducts({ categoryDocs, shops, usersByEmail });
    const carts = await createCarts(usersByEmail, products);
    const { orders, payments } = await createOrdersAndPayments(usersByEmail, products);
    const deliveredOrder = orders.find((order) => order.status === ORDER_STATUS.DELIVERED);
    const firstPaidOrder = orders.find((order) => order.paymentStatus === PAYMENT_STATUS.PAID);
    const shopWalletSeed = await createWallets({ shops, usersByEmail, deliveredOrder });
    const userWalletSeed = await createUserWallets({ usersByEmail, paidOrder: firstPaidOrder });
    const notifications = await createNotifications({ usersByEmail, shops, products, orders, payments });
    const chatSeed = await createConversations({ usersByEmail, shops });

    const created = {
      permissions: await Permission.countDocuments(),
      roles: await Role.countDocuments(),
      users: users.length,
      categories: categoryDocs.length,
      shops: shops.length,
      shopinvitations: await ShopInvitation.countDocuments(),
      products: products.length,
      carts: carts.length,
      orders: orders.length,
      payments: payments.length,
      wallets: shopWalletSeed.wallets.length,
      wallettransactions: shopWalletSeed.transactions.length,
      withdrawalrequests: shopWalletSeed.withdrawals.length,
      userwallets: userWalletSeed.wallets.length,
      userwallettopups: userWalletSeed.topups.length,
      userwallettransactions: userWalletSeed.transactions.length,
      userwalletwithdrawals: userWalletSeed.withdrawals.length,
      notifications: notifications.length,
      conversations: chatSeed.conversations.length,
      messages: chatSeed.messages.length,
    };

    printSummary({ dbName, deleted, created, users });
  } finally {
    await disconnectDB();
    await mongoose.disconnect().catch(() => {});
  }
};

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});
