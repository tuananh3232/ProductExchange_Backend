import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_ENUM, ROLES } from '../constants/role.constant.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Không trả về password trong query
    },
    avatar: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      province: { type: String, default: '' },
      district: { type: String, default: '' },
      detail: { type: String, default: '' },
    },
    role: {
      type: String,
      enum: ROLE_ENUM,
      default: ROLES.USER,
    },
    roles: {
      type: [
        {
          type: String,
          enum: ROLE_ENUM,
        },
      ],
      default: [ROLES.USER],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    emailVerificationToken: {
      type: String,
      select: false,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      select: false,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    kyc: {
      fullName: { type: String, default: '' },
      idNumber: { type: String, default: '' },
      frontImage: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
      },
      backImage: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
      },
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
      },
      rejectionReason: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true, // Tự thêm createdAt, updatedAt
    versionKey: false,
  }
);

// Giữ tương thích với code cũ: role đơn vẫn được duy trì từ danh sách roles
userSchema.pre('validate', function () {
  const declaredRole = this.role || ROLES.USER;
  const normalizedRoles = Array.isArray(this.roles) ? [...new Set(this.roles.filter(Boolean))] : [];

  if (!normalizedRoles.length) {
    normalizedRoles.push(declaredRole);
  } else if (normalizedRoles.length === 1 && normalizedRoles[0] === ROLES.USER && declaredRole !== ROLES.USER) {
    normalizedRoles[0] = declaredRole;
  } else if (declaredRole !== ROLES.USER && !normalizedRoles.includes(declaredRole)) {
    normalizedRoles.unshift(declaredRole);
  }

  if (normalizedRoles.includes(ROLES.ADMIN)) {
    this.role = ROLES.ADMIN;
  } else {
    this.role = declaredRole;
  }

  this.roles = normalizedRoles;
});

// Hash password trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method: so sánh password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: loại bỏ trường nhạy cảm khi trả về JSON
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
