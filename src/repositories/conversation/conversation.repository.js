import Conversation from '../../models/conversation.model.js'

const populateConversation = (query) =>
  query
    .populate('participants', 'name email avatar roles')
    .populate('shopId', 'name slug logo owner staff staffPermissions isActive')
    .populate('customerId', 'name email avatar roles')
    .populate('lastMessage.senderId', 'name email avatar')
    .populate('lastMessage.senderUserId', 'name email avatar')
    .populate('lastMessage.senderShopId', 'name slug logo')

export const create = (data) => Conversation.create(data)

export const findById = (id) => populateConversation(Conversation.findById(id))

export const findDirectByParticipantKey = (participantKey) =>
  populateConversation(Conversation.findOne({ type: 'DIRECT', participantKey, isActive: true }))

export const findShopByCustomerKey = (shopCustomerKey) =>
  populateConversation(Conversation.findOne({ type: 'SHOP', shopCustomerKey, isActive: true }))

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'updatedAt', sortOrder = -1 }) =>
  populateConversation(Conversation.find(filter))
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Conversation.countDocuments(filter)

export const updateById = (id, data) =>
  populateConversation(Conversation.findByIdAndUpdate(id, data, { new: true, runValidators: true }))
