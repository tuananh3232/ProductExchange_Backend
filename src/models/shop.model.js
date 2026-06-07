import mongoose from 'mongoose';
import { SHOP_STATUS, SHOP_STATUS_ENUM } from '../constants/status.constant.js';

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên shop là bắt buộc'],
      trim: true,
      maxlength: [120, 'Tên shop không được vượt quá 120 ký tự'],
    },
    slug: {
      type: String,
      required: [true, 'Slug của shop là bắt buộc'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Mô tả không được vượt quá 1000 ký tự'],
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
      required: [true, 'Chủ shop là bắt buộc'],
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
      maxlength: [500, 'Lý do từ chối không được vượt quá 500 ký tự'],
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
