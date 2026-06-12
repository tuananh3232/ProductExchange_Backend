import * as shopInvitationRepo from '../../repositories/shop-invitation/shop-invitation.repository.js';
import * as shopRepo from '../../repositories/shop/shop.repository.js';
import User from '../../models/user.model.js';
import AppError from '../../utils/app-error.util.js';
import ERRORS from '../../constants/error.constant.js';
import HTTP_STATUS from '../../constants/http-status.constant.js';
import { buildPaginationMeta } from '../../utils/pagination.util.js';
import { INVITATION_STATUS } from '../../constants/status.constant.js';
import { ROLES } from '../../constants/role.constant.js';
import PERMISSIONS, { SHOP_STAFF_PERMISSIONS } from '../../constants/permission.constant.js';
import { assertShopPermission } from '../../utils/data-scope.util.js';
import { env } from '../../configs/env.config.js';
import { sendStaffInvitationEmail } from '../../utils/mail.util.js';
import { notifySafely } from '../notification/notification.service.js';
import { NOTIFICATION_TARGET_TYPES, NOTIFICATION_TYPES } from '../../constants/notification.constant.js';

const toIdString = (value) => (value && value._id ? value._id.toString() : value ? value.toString() : null);
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const buildStaffInvitationUrl = ({ invitationId, shopId }) => {
  if (env.staffInvitation.urlTemplate) {
    return env.staffInvitation.urlTemplate
      .replaceAll('{invitationId}', encodeURIComponent(invitationId))
      .replaceAll('{shopId}', encodeURIComponent(shopId));
  }

  const baseUrl = env.frontendUrl.replace(/\/+$/, '');
  const path = env.staffInvitation.path.startsWith('/')
    ? env.staffInvitation.path
    : `/${env.staffInvitation.path}`;
  const invitationUrl = new URL(path, `${baseUrl}/`);
  invitationUrl.searchParams.set('invitationId', invitationId);
  invitationUrl.searchParams.set('shopId', shopId);
  return invitationUrl.toString();
};

const notifyStaffInvitation = async ({ invitation, shop, invitee, inviterContext }) => {
  try {
    const invitationUrl = buildStaffInvitationUrl({
      invitationId: invitation._id.toString(),
      shopId: shop._id.toString(),
    });

    await sendStaffInvitationEmail({
      to: invitee.email,
      name: invitee.name,
      shopName: shop.name,
      inviterName: inviterContext?.name || shop.owner?.name || '',
      invitationUrl,
    });
  } catch (error) {
    console.warn('Failed to send staff invitation email:', error.message);
  }
};

const ensureStaffInviteeRole = (user) => {
  const roleSet = new Set(user?.roles || []);

  if (!roleSet.has(ROLES.MEMBER)) {
    throw new AppError('Chỉ có thể mời member làm staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF);
  }

  if (roleSet.has(ROLES.ADMIN)) {
    throw new AppError('Không thể mời admin làm staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVALID_STAFF);
  }
};

/**
 * Send invitation to user to join shop as staff
 */
export const sendInvitation = async (shopId, inviterContext, inviteeEmail, permissions = []) => {
  // Verify shop exists and inviter has access
  const shop = await shopRepo.findById(shopId);
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND);
  }

  const userId = inviterContext?._id?.toString();
  const ownerId = shop.owner?._id?.toString() || shop.owner?.toString();

  await assertShopPermission({
    user: inviterContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_INVITE,
    message: 'Bạn không có quyền gửi lời mời staff',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  });

  const uniquePermissions = [...new Set(permissions || [])];
  const invalidPermissions = uniquePermissions.filter((permission) => !SHOP_STAFF_PERMISSIONS.includes(permission));
  if (invalidPermissions.length) {
    throw new AppError('Danh sách quyền staff chứa quyền không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.RBAC.PERMISSION_NOT_FOUND);
  }

  const email = normalizeEmail(inviteeEmail);
  if (!email) {
    throw new AppError('Email is required', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.REQUIRED);
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError('Invalid email', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT);
  }

  // Verify invitee exists
  const invitee = await User.findOne({ email });
  if (!invitee) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND);
  }
  if (!invitee.isActive) {
    throw new AppError('Account is inactive', HTTP_STATUS.BAD_REQUEST, ERRORS.AUTH.ACCOUNT_INACTIVE);
  }
  const inviteeIdString = invitee._id.toString();

  ensureStaffInviteeRole(invitee);

  // Cannot invite self
  if (userId && inviteeIdString === userId) {
    throw new AppError('Không thể gửi lời mời cho chính mình', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.CANNOT_INVITE_SELF);
  }

  // Cannot invite owner
  if (inviteeIdString === ownerId) {
    throw new AppError('Không thể mời owner là staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.CANNOT_INVITE_OWNER);
  }

  // Check if already staff
  const isAlreadyStaff = (shop.staff || []).some(
    (staffId) => toIdString(staffId) === inviteeIdString
  );

  if (isAlreadyStaff) {
    throw new AppError('Người dùng đã là nhân viên của shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.ALREADY_STAFF);
  }

  // Check for active pending invitation
  const existingInvitation = await shopInvitationRepo.findOne({
    shop: shopId,
    invitee: invitee._id,
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });

  if (existingInvitation) {
    throw new AppError('Đã có lời mời chưa được xử lý từ trước', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Create invitation
  const invitation = await shopInvitationRepo.create({
    shop: shopId,
    invitee: invitee._id,
    inviter: inviterContext._id,
    role: 'STAFF',
    permissions: uniquePermissions,
    status: INVITATION_STATUS.PENDING,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  await notifyStaffInvitation({ invitation, shop, invitee, inviterContext });
  await notifySafely({
    recipient: invitee._id,
    sender: inviterContext._id,
    type: NOTIFICATION_TYPES.SHOP_STAFF_INVITED,
    title: 'Loi moi tham gia shop',
    message: `Ban duoc moi tham gia shop ${shop.name}`,
    targetType: NOTIFICATION_TARGET_TYPES.SHOP,
    targetId: shop._id,
    actionUrl: `/shops/${shop._id}/invitations`,
    data: { shopId: shop._id, invitationId: invitation._id },
  });

  return shopInvitationRepo.findById(invitation._id);
};

/**
 * Accept shop invitation
 */
export const acceptInvitation = async (invitationId, userContext) => {
  const invitation = await shopInvitationRepo.findById(invitationId);
  if (!invitation) {
    throw new AppError('Lời mời không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Verify user is the invitee
  const userId = userContext?._id?.toString();
  const inviteeId = invitation.invitee?._id?.toString() || invitation.invitee?.toString();

  if (userId !== inviteeId) {
    throw new AppError('Lời mời không phải của bạn', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN);
  }

  // Check invitation status
  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new AppError('Lời mời đã được chấp nhận trước đó', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_ALREADY_ACCEPTED);
  }

  if (invitation.status === INVITATION_STATUS.REJECTED) {
    throw new AppError('Lời mời đã bị từ chối trước đó', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_ALREADY_REJECTED);
  }

  // Check if invitation expired
  if (new Date() > invitation.expiresAt) {
    await shopInvitationRepo.findByIdAndUpdate(invitationId, { status: INVITATION_STATUS.EXPIRED });
    throw new AppError('Lời mời đã hết hạn', HTTP_STATUS.GONE, ERRORS.SHOP.INVITATION_EXPIRED);
  }

  // Get shop
  const shop = await shopRepo.findById(invitation.shop?._id || invitation.shop);
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND);
  }

  // Update user roles to include STAFF
  const user = await User.findById(userContext._id);
  if (!user) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND);
  }
  ensureStaffInviteeRole(user);

  const userRoles = new Set(user.roles || []);
  userRoles.add(ROLES.STAFF);
  user.roles = [...userRoles];
  await user.save();

  // Add user to shop staff
  await shopRepo.addStaff(shop._id, userContext._id);

  // Update invitation status
  const updatedInvitation = await shopInvitationRepo.findByIdAndUpdate(invitationId, {
    status: INVITATION_STATUS.ACCEPTED,
  });

  // Auto-assign permissions if specified
  if (invitation.permissions && invitation.permissions.length > 0) {
    const currentPermissions = (shop.staffPermissions || []).filter(
      (entry) => entry.staffUser?.toString() !== userContext._id.toString()
    );

    currentPermissions.push({
      staffUser: userContext._id,
      permissions: invitation.permissions,
      updatedBy: invitation.inviter,
      updatedAt: new Date(),
    });

    await shopRepo.updateById(shop._id, { staffPermissions: currentPermissions });
  }

  await notifySafely({
    recipient: shop.owner?._id || shop.owner,
    sender: userContext._id,
    type: NOTIFICATION_TYPES.SHOP_STAFF_ACCEPTED,
    title: 'Staff da chap nhan loi moi',
    message: 'Loi moi tham gia shop da duoc chap nhan',
    targetType: NOTIFICATION_TARGET_TYPES.SHOP,
    targetId: shop._id,
    actionUrl: `/shops/${shop._id}/staff`,
    data: { shopId: shop._id, invitationId: invitation._id, staffUserId: userContext._id },
  });

  return updatedInvitation;
};

/**
 * Reject shop invitation
 */
export const rejectInvitation = async (invitationId, userContext) => {
  const invitation = await shopInvitationRepo.findById(invitationId);
  if (!invitation) {
    throw new AppError('Lời mời không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Verify user is the invitee
  const userId = userContext?._id?.toString();
  const inviteeId = invitation.invitee?._id?.toString() || invitation.invitee?.toString();

  if (userId !== inviteeId) {
    throw new AppError('Lời mời không phải của bạn', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN);
  }

  // Check invitation status
  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    throw new AppError('Lời mời đã được chấp nhận trước đó', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_ALREADY_ACCEPTED);
  }

  if (invitation.status === INVITATION_STATUS.REJECTED) {
    throw new AppError('Lời mời đã bị từ chối trước đó', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_ALREADY_REJECTED);
  }

  // Check if invitation expired
  if (new Date() > invitation.expiresAt) {
    await shopInvitationRepo.findByIdAndUpdate(invitationId, { status: INVITATION_STATUS.EXPIRED });
    throw new AppError('Lời mời đã hết hạn', HTTP_STATUS.GONE, ERRORS.SHOP.INVITATION_EXPIRED);
  }

  // Update invitation status
  return shopInvitationRepo.findByIdAndUpdate(invitationId, {
    status: INVITATION_STATUS.REJECTED,
    rejectionReason: '',
  });
};

export const handleInvitationAction = async (invitationId, userContext, action) => {
  if (action === 'accept') {
    return acceptInvitation(invitationId, userContext);
  }

  if (action === 'reject') {
    return rejectInvitation(invitationId, userContext);
  }

  throw new AppError('Hành động lời mời không hợp lệ', HTTP_STATUS.BAD_REQUEST, ERRORS.VALIDATION.INVALID_FORMAT);
};

/**
 * Get user's pending invitations
 */
export const getMyPendingInvitations = async (userId, { page, limit, skip, sortBy, sortOrder }) => {
  const [invitations, total] = await Promise.all([
    shopInvitationRepo.findPendingByInvitee(userId, { skip, limit, sortBy, sortOrder }),
    shopInvitationRepo.countPendingByInvitee(userId),
  ]);

  return {
    invitations,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Get shop invitations (for shop owner)
 */
export const getShopInvitations = async (shopId, ownerContext, status, { page, limit, skip, sortBy, sortOrder }) => {
  // Verify shop exists
  const shop = await shopRepo.findById(shopId);
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND);
  }

  await assertShopPermission({
    user: ownerContext,
    shopId,
    permissionKey: PERMISSIONS.SHOP_STAFF_READ,
    message: 'Bạn không có quyền xem lời mời staff',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  });

  let [invitations, total] = [[], 0];

  if (status && Object.values(INVITATION_STATUS).includes(status)) {
    [invitations, total] = await Promise.all([
      shopInvitationRepo.findByShopAndStatus(shopId, status, { skip, limit, sortBy, sortOrder }),
      shopInvitationRepo.countByShopAndStatus(shopId, status),
    ]);
  } else {
    // Get all invitations for shop
    [invitations, total] = await Promise.all([
      shopInvitationRepo.findMany({ shop: shopId }, { skip, limit, sortBy, sortOrder }),
      shopInvitationRepo.countMany({ shop: shopId }),
    ]);
  }

  return {
    invitations,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Cancel invitation (shop owner only)
 */
export const cancelInvitation = async (invitationId, ownerContext) => {
  const invitation = await shopInvitationRepo.findById(invitationId);
  if (!invitation) {
    throw new AppError('Lời mời không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Get shop
  const shop = await shopRepo.findById(invitation.shop?._id || invitation.shop);
  if (!shop) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND);
  }

  await assertShopPermission({
    user: ownerContext,
    shopId: shop._id,
    permissionKey: PERMISSIONS.SHOP_STAFF_REMOVE,
    message: 'Bạn không có quyền hủy lời mời staff',
    errorCode: ERRORS.AUTH.FORBIDDEN,
  });

  // Can only cancel pending invitations
  if (invitation.status !== INVITATION_STATUS.PENDING) {
    throw new AppError('Chỉ có thể hủy lời mời đang chờ', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Delete invitation
  return shopInvitationRepo.deleteById(invitationId);
};

export default {
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  handleInvitationAction,
  getMyPendingInvitations,
  getShopInvitations,
  cancelInvitation,
};
