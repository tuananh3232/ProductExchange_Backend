import mongoose from 'mongoose';
import { INVITATION_STATUS, INVITATION_STATUS_ENUM } from '../constants/status.constant.js';

const shopInvitationSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop is required'],
      index: true,
    },
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Invitee is required'],
      index: true,
    },
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter is required'],
    },
    role: {
      type: String,
      enum: ['STAFF', 'MANAGER'],
      default: 'STAFF',
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: INVITATION_STATUS_ENUM,
      default: INVITATION_STATUS.PENDING,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    rejectionReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for finding active invitations for a user
shopInvitationSchema.index({ invitee: 1, status: 1 });

// Compound index for finding invitations for a shop
shopInvitationSchema.index({ shop: 1, status: 1 });

export default mongoose.model('ShopInvitation', shopInvitationSchema);
