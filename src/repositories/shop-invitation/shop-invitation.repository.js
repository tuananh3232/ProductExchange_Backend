import ShopInvitation from '../../models/shop-invitation.model.js';

export const create = async (data) => {
  return ShopInvitation.create(data);
};

export const findById = async (id) => {
  return ShopInvitation.findById(id)
    .populate('shop', 'name slug')
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const findMany = async (filter = {}, options = {}) => {
  const { skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
  const sortObj = { [sortBy]: sortOrder };
  
  return ShopInvitation.find(filter)
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .populate('shop', 'name slug')
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const countMany = async (filter = {}) => {
  return ShopInvitation.countDocuments(filter);
};

export const findByIdAndUpdate = async (id, update) => {
  return ShopInvitation.findByIdAndUpdate(id, update, { new: true })
    .populate('shop', 'name slug')
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const findOneAndUpdate = async (filter, update) => {
  return ShopInvitation.findOneAndUpdate(filter, update, { new: true })
    .populate('shop', 'name slug')
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const findOne = async (filter) => {
  return ShopInvitation.findOne(filter)
    .populate('shop', 'name slug')
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const deleteById = async (id) => {
  return ShopInvitation.findByIdAndDelete(id);
};

export const deleteMany = async (filter) => {
  return ShopInvitation.deleteMany(filter);
};

export const findPendingByInvitee = async (inviteeId, options = {}) => {
  const { skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
  const sortObj = { [sortBy]: sortOrder };
  
  return ShopInvitation.find({
    invitee: inviteeId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  })
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .populate('shop', 'name slug')
    .populate('inviter', 'email fullName');
};

export const countPendingByInvitee = async (inviteeId) => {
  return ShopInvitation.countDocuments({
    invitee: inviteeId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

export const findByShopAndStatus = async (shopId, status, options = {}) => {
  const { skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = options;
  const sortObj = { [sortBy]: sortOrder };
  
  return ShopInvitation.find({
    shop: shopId,
    status,
  })
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .populate('invitee', 'email fullName')
    .populate('inviter', 'email fullName');
};

export const countByShopAndStatus = async (shopId, status) => {
  return ShopInvitation.countDocuments({
    shop: shopId,
    status,
  });
};

export default {
  create,
  findById,
  findMany,
  countMany,
  findByIdAndUpdate,
  findOneAndUpdate,
  findOne,
  deleteById,
  deleteMany,
  findPendingByInvitee,
  countPendingByInvitee,
  findByShopAndStatus,
  countByShopAndStatus,
};
