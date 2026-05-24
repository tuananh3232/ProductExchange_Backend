import mongoose from 'mongoose'
import { PRODUCT_STATUS_ENUM } from '../constants/status.constant.js'

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
    views: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
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

productSchema.index({ title: 'text', description: 'text' })
productSchema.index({ category: 1, status: 1 })
productSchema.index({ owner: 1 })
productSchema.index({ shop: 1, status: 1 })
productSchema.index({ seller: 1, status: 1 })
productSchema.index({ ownerType: 1, status: 1 })
productSchema.index({ listingType: 1, status: 1 })
productSchema.index({ createdAt: -1 })

export default mongoose.model('Product', productSchema)
