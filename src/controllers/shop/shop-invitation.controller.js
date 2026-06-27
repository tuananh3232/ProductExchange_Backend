import * as shopInvitationService from '../../services/shop/shop-invitation.service.js';
import { sendSuccess } from '../../utils/response.util.js';
import { getPaginationParams } from '../../utils/pagination.util.js';
import MESSAGES from '../../constants/message.constant.js';
import HTTP_STATUS from '../../constants/http-status.constant.js';

const INVITE_DEBUG_ENABLED = process.env.DEBUG_SHOP_STAFF_INVITE === 'true';

const logInviteDebug = (stage, payload = {}) => {
  if (!INVITE_DEBUG_ENABLED) return;
  console.log(`[shop-staff-invite] ${stage}`, payload);
};

export const sendInvitation = async (req, res, next) => {
  try {
    logInviteDebug('controller.sendInvitation.enter', {
      shopId: req.params.id,
      userId: req.user?._id?.toString?.() || req.user?._id || null,
      email: req.body?.email || null,
      permissionCount: Array.isArray(req.body?.permissions) ? req.body.permissions.length : 0,
    });

    const invitation = await shopInvitationService.sendInvitation(
      req.params.id,
      req.user,
      req.body.email,
      req.body.permissions || []
    );
    logInviteDebug('controller.sendInvitation.beforeResponse', {
      shopId: req.params.id,
      invitationId: invitation?._id?.toString?.() || invitation?._id || null,
      status: invitation?.status || null,
    });
    sendSuccess(res, {
      message: MESSAGES.SHOP.INVITATION_SENT,
      data: { invitation },
      statusCode: HTTP_STATUS.CREATED,
    });
  } catch (error) {
    logInviteDebug('controller.sendInvitation.error', {
      shopId: req.params.id,
      email: req.body?.email || null,
      error: error.message,
    });
    next(error);
  }
};

export const getMyPendingInvitations = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query);
    const { invitations, meta } = await shopInvitationService.getMyPendingInvitations(
      req.user._id,
      pagination
    );
    sendSuccess(res, {
      message: MESSAGES.SHOP.MY_INVITATIONS_FETCHED,
      data: { invitations },
      meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getShopInvitations = async (req, res, next) => {
  try {
    const pagination = getPaginationParams(req.query);
    const { invitations, meta } = await shopInvitationService.getShopInvitations(
      req.params.id,
      req.user,
      req.query.status,
      pagination
    );
    sendSuccess(res, {
      message: MESSAGES.SHOP.INVITATIONS_FETCHED,
      data: { invitations },
      meta,
    });
  } catch (error) {
    next(error);
  }
};

export const handleInvitationAction = async (req, res, next) => {
  try {
    const invitation = await shopInvitationService.handleInvitationAction(
      req.params.invitationId,
      req.user,
      req.body.action
    );
    const message = req.body.action === 'accept' ? MESSAGES.SHOP.INVITATION_ACCEPTED : MESSAGES.SHOP.INVITATION_REJECTED;
    sendSuccess(res, {
      message,
      data: { invitation },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelInvitation = async (req, res, next) => {
  try {
    await shopInvitationService.cancelInvitation(req.params.invitationId, req.user);
    sendSuccess(res, {
      message: MESSAGES.SHOP.INVITATION_CANCELLED,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

export default {
  sendInvitation,
  getMyPendingInvitations,
  getShopInvitations,
  handleInvitationAction,
  cancelInvitation,
};
