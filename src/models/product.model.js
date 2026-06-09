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
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: [200, 'Title must not exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [3000, 'Description must not exceed 3000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number'],
    },
    stock: {
      type: Number,
      default: 1,
      min: [0, 'Stock must not be negative'],
    },
    listingType: {
      type: String,
      enum: ['sell'],
      required: [true, 'Listing type is required'],
    },
    condition: {
      type: String,
      enum: ['new', 'like_new', 'good', 'fair', 'poor'],
      required: [true, 'Condition is required'],
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
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
    isActive: { type: Boolean, default: true },
    style: { type: String, enum: PRODUCT_STYLES, default: null },
    roomType: { type: String, enum: ROOM_TYPES, default: null },
    colorTone: { type: String, enum: COLOR_TONES, default: null },
    decorRole: { type: String, enum: DECOR_ROLES, default: null },
    comboPriority: { type: Number, default: 0 },
    dimensions: {
      widthCm: { type: Number, min: 1, default: null },
      heightCm: { type: Number, min: 1, default: null },
      depthCm: { type: Number, min: 0, default: null },
    },
    visualProfile: {
      placementType: {
        type: String,
        enum: ['wall_mounted', 'floor_standing', 'surface_standing'],
        default: 'wall_mounted',
      },
      anchor: {
        type: String,
        enum: ['center', 'bottom_center', 'bottom_left', 'bottom_right'],
        default: 'center',
      },
      isVisualizerReady: { type: Boolean, default: false },
    },
    visualAssets: {
      sourceImage: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
      },
      cutoutPreview: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
        widthPx: { type: Number, default: null },
        heightPx: { type: Number, default: null },
        provider: { type: String, enum: ['manual', 'remove_bg'], default: null },
      },
      cutouts: [
        {
          view: {
            type: String,
            enum: ['front', 'left_angle', 'right_angle', 'back'],
          },
          url: { type: String },
          publicId: { type: String },
          widthPx: { type: Number },
          heightPx: { type: Number },
          status: {
            type: String,
            enum: ['processing', 'ready', 'failed'],
            default: 'ready',
          },
          provider: {
            type: String,
            enum: ['manual', 'remove_bg'],
            default: 'manual',
          },
        },
      ],
    },
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
    if (!this.shop) this.invalidate('shop', 'Shop product requires shop')
    if (this.seller) this.invalidate('seller', 'Shop product cannot have seller')
  }

  if (this.ownerType === PRODUCT_OWNER_TYPES.SELLER) {
    if (!this.seller) this.invalidate('seller', 'Seller product requires seller')
    if (this.shop) this.invalidate('shop', 'Seller product cannot have shop')
  }
})

productSchema.index({ title: 'text', description: 'text' }, { weights: { title: 10, description: 2 }, default_language: 'none' })
productSchema.index({ category: 1, status: 1 })
productSchema.index({ owner: 1 })
productSchema.index({ shop: 1, status: 1 })
productSchema.index({ seller: 1, status: 1 })
productSchema.index({ ownerType: 1, status: 1 })
productSchema.index({ listingType: 1, status: 1 })
productSchema.index({ createdAt: -1 })
productSchema.index({ isActive: 1, status: 1, stock: 1, decorRole: 1, price: 1 })

export default mongoose.model('Product', productSchema)
