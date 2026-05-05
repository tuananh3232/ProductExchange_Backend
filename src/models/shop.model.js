import mongoose from 'mongoose';
import { SHOP_STATUS, SHOP_STATUS_ENUM } from '../constants/status.constant.js';

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: [120, 'Shop name must not exceed 120 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Shop slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Description must not exceed 1000 characters'],
    },
    logo: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    address: {
      province: { type: String, default: '' },
      district: { type: String, default: '' },
      detail: { type: String, default: '' },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true,
    },
    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    staffPermissions: [
      {
        staffUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        permissions: {
          type: [String],
          default: [],
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: SHOP_STATUS_ENUM,
      default: SHOP_STATUS.DRAFT,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: [500, 'Rejection reason must not exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

shopSchema.index({ name: 'text', description: 'text' });
shopSchema.index({ owner: 1, isActive: 1 });
shopSchema.index({ owner: 1, status: 1 });
shopSchema.index({ staff: 1, isActive: 1 });
shopSchema.index({ 'staffPermissions.staffUser': 1, isActive: 1 });
shopSchema.index({ status: 1, createdAt: -1 });
shopSchema.index({ createdAt: -1 });

const Shop = mongoose.model('Shop', shopSchema);

export default Shop;
