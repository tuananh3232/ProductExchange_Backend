import mongoose from 'mongoose';
import { PRODUCT_STATUS_ENUM } from '../constants/status.constant.js';

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
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
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
);

productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ owner: 1 });
productSchema.index({ shop: 1, status: 1 });
productSchema.index({ listingType: 1, status: 1 });
productSchema.index({ createdAt: -1 });

export default mongoose.model('Product', productSchema);
