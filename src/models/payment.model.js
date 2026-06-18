import mongoose from 'mongoose';
import { PAYMENT_STATUS, PAYMENT_STATUS_ENUM } from '../constants/status.constant.js';

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      default: 'vnpay',
      index: true,
    },
    method: {
      type: String,
      default: 'vnpay',
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_ENUM,
      default: PAYMENT_STATUS.PENDING_PAYMENT,
      index: true,
    },
    transactionRef: {
      type: String,
      required: true,
      unique: true,
    },
    bankCode: {
      type: String,
      default: '',
    },
    responseCode: {
      type: String,
      default: '',
    },
    vnpTransactionNo: {
      type: String,
      default: '',
    },
    rawCallbackData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paidAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciliationState: {
      type: String,
      enum: ['none', 'matched', 'manual_review', 'refund_pending'],
      default: 'none',
    },
    failureReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    adminNote: {
      type: String,
      default: '',
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Sparse unique: single-order payments cannot share the same order; batch payments (order=null) are exempt
paymentSchema.index({ order: 1 }, { unique: true, sparse: true });
paymentSchema.index({ orders: 1 }, { sparse: true });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
