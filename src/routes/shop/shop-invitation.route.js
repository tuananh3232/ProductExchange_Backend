import { Router } from 'express';
import * as shopInvitationController from '../../controllers/shop/shop-invitation.controller.js';
import { authenticate, requirePermissions } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  sendInvitationSchema,
  invitationActionSchema,
} from '../../validations/shop/shop.validation.js';
import PERMISSIONS from '../../constants/permission.constant.js';

const router = Router();

// Get user's pending invitations
router.get(
  '/my/invitations',
  authenticate,
  shopInvitationController.getMyPendingInvitations
);

// Accept or reject invitation
router.post(
  '/invitations/:invitationId/action',
  authenticate,
  validate(invitationActionSchema),
  shopInvitationController.handleInvitationAction
);

// Cancel invitation (shop owner only)
router.delete(
  '/invitations/:invitationId',
  authenticate,
  shopInvitationController.cancelInvitation
);

// Send invitation to user (shop owner only)
router.post(
  '/:id/invitations',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF),
  validate(sendInvitationSchema),
  shopInvitationController.sendInvitation
);

// Get shop invitations (shop owner only)
router.get(
  '/:id/invitations',
  authenticate,
  requirePermissions(PERMISSIONS.SHOP_MANAGE_STAFF),
  shopInvitationController.getShopInvitations
);

export default router;
