import mongoose from 'mongoose';
import { PAYMENT_STATUS, PAYMENT_STATUS_ENUM } from '../constants/status.constant.js';

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
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
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

paymentSchema.index({ order: 1, provider: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;