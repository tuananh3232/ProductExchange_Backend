import mongoose from 'mongoose';
import { ORDER_STATUS, ORDER_STATUS_ENUM, PAYMENT_STATUS, PAYMENT_STATUS_ENUM } from '../constants/status.constant.js';

const orderHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      required: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Order history note must not exceed 500 characters'],
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

const orderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    deliveryStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_ENUM,
      default: ORDER_STATUS.PENDING,
      index: true,
    },
    shippingAddress: {
      province: { type: String, default: '' },
      district: { type: String, default: '' },
      detail: { type: String, default: '' },
    },
    note: {
      type: String,
      default: '',
      maxlength: [1000, 'Order note must not exceed 1000 characters'],
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_ENUM,
      default: PAYMENT_STATUS.UNPAID,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    paymentProvider: {
      type: String,
      default: '',
    },
    paymentRef: {
      type: String,
      default: '',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    history: {
      type: [orderHistorySchema],
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

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ shop: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
