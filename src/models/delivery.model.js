import mongoose from 'mongoose';
import { DELIVERY_STATUS, DELIVERY_STATUS_ENUM } from '../constants/status.constant.js';

const deliveryHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: DELIVERY_STATUS_ENUM,
      required: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Delivery history note must not exceed 500 characters'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deliveryStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: DELIVERY_STATUS_ENUM,
      default: DELIVERY_STATUS.ASSIGNED,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedReason: {
      type: String,
      default: '',
      maxlength: [500, 'Failed reason must not exceed 500 characters'],
    },
    history: {
      type: [deliveryHistorySchema],
      default: [],
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

deliverySchema.index({ deliveryStaff: 1, status: 1, createdAt: -1 });
deliverySchema.index({ shop: 1, status: 1, createdAt: -1 });

const Delivery = mongoose.model('Delivery', deliverySchema);

export default Delivery;
