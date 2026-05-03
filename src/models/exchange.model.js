import mongoose from 'mongoose';
import { EXCHANGE_STATUS_ENUM } from '../constants/status.constant.js';

const exchangeSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required'],
    },
    requestedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Requested product is required'],
    },
    offeredProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Offered product is required'],
    },
    message: {
      type: String,
      maxlength: [500, 'Message must not exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: EXCHANGE_STATUS_ENUM,
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    history: {
      type: [
        {
          status: {
            type: String,
            enum: EXCHANGE_STATUS_ENUM,
            required: true,
          },
          note: {
            type: String,
            default: '',
            maxlength: [500, 'Exchange history note must not exceed 500 characters'],
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
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

exchangeSchema.index({ requester: 1, status: 1 });
exchangeSchema.index({ receiver: 1, status: 1 });
exchangeSchema.index({ requestedProduct: 1 });
exchangeSchema.index({ offeredProduct: 1 });

export default mongoose.model('Exchange', exchangeSchema);
