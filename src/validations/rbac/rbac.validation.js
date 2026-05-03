import Joi from 'joi';
import { ROLE_ENUM } from '../../constants/role.constant.js';

export const updateRolePermissionsSchema = Joi.object({
  permissionKeys: Joi.array().items(Joi.string().trim().required()).min(1).required(),
});

export const assignRolesSchema = Joi.object({
  roles: Joi.array().items(Joi.string().valid(...ROLE_ENUM)).min(1).required(),
});
