import * as shopInvitationRepo from '../../repositories/shop-invitation/shop-invitation.repository.js';
import * as shopRepo from '../../repositories/shop/shop.repository.js';
import User from '../../models/user.model.js';
import AppError from '../../utils/app-error.util.js';
import ERRORS from '../../constants/error.constant.js';
import HTTP_STATUS from '../../constants/http-status.constant.js';
import { buildPaginationMeta } from '../../utils/pagination.util.js';
import { INVITATION_STATUS } from '../../constants/status.constant.js';
import { ROLES } from '../../constants/role.constant.js';

/**
 * Send invitation to user to join shop as staff
 */
export const sendInvitation = async (shopId, inviterContext, inviteeId, permissions = []) => {
  // Verify shop exists and inviter has access
  const shop = await shopRepo.findById(shopId);
  if (!shop || !shop.isActive) {
    throw new AppError('Không tìm thấy shop', HTTP_STATUS.NOT_FOUND, ERRORS.SHOP.NOT_FOUND);
  }

  // Only shop owner can send invitations
  const userId = inviterContext?._id?.toString();
  const ownerId = shop.owner?._id?.toString() || shop.owner?.toString();
  
  if (userId !== ownerId && !new Set(inviterContext?.roles || []).has(ROLES.ADMIN)) {
    throw new AppError('Chỉ chủ shop có thể gửi lời mời', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN);
  }

  // Verify invitee exists
  const invitee = await User.findById(inviteeId);
  if (!invitee) {
    throw new AppError('Người dùng không tồn tại', HTTP_STATUS.NOT_FOUND, ERRORS.GENERAL.NOT_FOUND);
  }

  // Cannot invite self
  if (inviteeId.toString() === ownerId) {
    throw new AppError('Không thể gửi lời mời cho chính mình', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.CANNOT_INVITE_SELF);
  }

  // Cannot invite owner
  if (inviteeId.toString() === ownerId) {
    throw new AppError('Không thể mời owner là staff', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.CANNOT_INVITE_OWNER);
  }

  // Check if already staff
  const isAlreadyStaff = (shop.staff || []).some(
    (staffId) => staffId?._id?.toString() === inviteeId.toString() || staffId?.toString() === inviteeId.toString()
  );

  if (isAlreadyStaff) {
    throw new AppError('Người dùng đã là nhân viên của shop', HTTP_STATUS.BAD_REQUEST, ERRORS.SHOP.ALREADY_STAFF);
  }

  // Check for active pending invitation
  const existingInvitation = await shopInvitationRepo.findOne({
    shop: shopId,
    invitee: inviteeId,
    status: INVITATION_STATUS.PENDING,
    expiresAt: { $gt: new Date() },
  });

  if (existingInvitation) {
    throw new AppError('Đã có lời mời chưa được xử lý từ trước', HTTP_STATUS.CONFLICT, ERRORS.SHOP.INVITATION_NOT_FOUND);
  }

  // Create invitation
  const invitation = await shopInvitationRepo.create({
    shop: shopId,
    invitee: inviteeId,
    inviter: inviterContext._id,
    role: 'STAFF',
    permissions: permissions.length > 0 ? permissions : [],
    status: INVITATION_STATUS.PENDING,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

  // Update user role to include STAFF
  const user = await User.findById(userContext._id);
  const userRoles = new Set(user.roles || [user.role].filter(Boolean));
  userRoles.add(ROLES.STAFF);
  user.roles = [...userRoles];
  if (!user.role) {
    user.role = ROLES.STAFF;
  }
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

  // Only shop owner can view invitations
  const userId = ownerContext?._id?.toString();
  const ownerId = shop.owner?._id?.toString() || shop.owner?.toString();

  if (userId !== ownerId && !new Set(ownerContext?.roles || []).has(ROLES.ADMIN)) {
    throw new AppError('Chỉ chủ shop có thể xem lời mời', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN);
  }

  let [invitations, total] = [[], 0];

  if (status && [INVITATION_STATUS.PENDING, INVITATION_STATUS.ACCEPTED, INVITATION_STATUS.REJECTED].includes(status)) {
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

  // Only shop owner can cancel invitations
  const userId = ownerContext?._id?.toString();
  const ownerId = shop.owner?._id?.toString() || shop.owner?.toString();

  if (userId !== ownerId && !new Set(ownerContext?.roles || []).has(ROLES.ADMIN)) {
    throw new AppError('Chỉ chủ shop có thể hủy lời mời', HTTP_STATUS.FORBIDDEN, ERRORS.AUTH.FORBIDDEN);
  }

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
