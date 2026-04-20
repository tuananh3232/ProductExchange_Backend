import mongoose from 'mongoose';

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
      enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    rejectionReason: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
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
