import mongoose from 'mongoose'
import { PRODUCT_STATUS_ENUM } from '../constants/status.constant.js'
import { COLOR_TONES, DECOR_ROLES, PRODUCT_STYLES, ROOM_TYPES } from '../constants/combo.constant.js'

export const PRODUCT_OWNER_TYPES = {
  SHOP: 'SHOP',
  SELLER: 'SELLER',
}

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tên sản phẩm là bắt buộc'],
      trim: true,
      maxlength: [200, 'Tên sản phẩm không được vượt quá 200 ký tự'],
    },
    description: {
      type: String,
      required: [true, 'Mô tả là bắt buộc'],
      maxlength: [3000, 'Mô tả không được vượt quá 3000 ký tự'],
    },
    price: {
      type: Number,
      required: [true, 'Giá là bắt buộc'],
      min: [0, 'Giá phải là số không âm'],
    },
    stock: {
      type: Number,
      default: 1,
      min: [0, 'Tồn kho không được là số âm'],
    },
    listingType: {
      type: String,
      enum: ['sell'],
      required: [true, 'Loại đăng bán là bắt buộc'],
    },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'poor'],
      required: [true, 'Tình trạng sản phẩm là bắt buộc'],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Danh mục là bắt buộc'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Chủ sở hữu là bắt buộc'],
    },
    ownerType: {
      type: String,
      enum: Object.values(PRODUCT_OWNER_TYPES),
      required: true,
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    location: {
      province: { type: String, default: '' },
      district: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_ENUM,
      default: 'available',
    },
    views: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    style: { type: String, enum: PRODUCT_STYLES, default: null },
    roomType: { type: String, enum: ROOM_TYPES, default: null },
    colorTone: { type: String, enum: COLOR_TONES, default: null },
    decorRole: { type: String, enum: DECOR_ROLES, default: null },
    comboPriority: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

productSchema.pre('validate', function () {
  if (!this.ownerType) {
    this.ownerType = this.shop ? PRODUCT_OWNER_TYPES.SHOP : PRODUCT_OWNER_TYPES.SELLER
  }

  if (this.ownerType === PRODUCT_OWNER_TYPES.SHOP) {
    if (!this.shop) this.invalidate('shop', 'Sản phẩm shop bắt buộc phải có shop')
    if (this.seller) this.invalidate('seller', 'Sản phẩm shop không được gắn seller')
  }

  if (this.ownerType === PRODUCT_OWNER_TYPES.SELLER) {
    if (!this.seller) this.invalidate('seller', 'Sản phẩm seller bắt buộc phải có seller')
    if (this.shop) this.invalidate('shop', 'Sản phẩm seller không được gắn shop')
  }
})

productSchema.index({ title: 'text', description: 'text' })
productSchema.index({ category: 1, status: 1 })
productSchema.index({ owner: 1 })
productSchema.index({ shop: 1, status: 1 })
productSchema.index({ seller: 1, status: 1 })
productSchema.index({ ownerType: 1, status: 1 })
productSchema.index({ listingType: 1, status: 1 })
productSchema.index({ createdAt: -1 })
productSchema.index({ isActive: 1, status: 1, stock: 1, decorRole: 1, price: 1 })

export default mongoose.model('Product', productSchema)
