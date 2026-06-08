import Message from '../../models/message.model.js'

const populateMessage = (query) =>
  query
    .populate('senderId', 'name email avatar roles')
    .populate('senderUserId', 'name email avatar roles')
    .populate('senderShopId', 'name slug logo')
    .populate('readBy.userId', 'name email avatar')

export const create = (data) => Message.create(data)

export const findMany = ({ filter = {}, skip = 0, limit = 20, sortBy = 'createdAt', sortOrder = -1 }) =>
  populateMessage(Message.find(filter))
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Message.countDocuments(filter)

export const markConversationAsRead = (conversationId, userId, readAt = new Date()) =>
  Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
    },
    {
      $push: {
        readBy: {
          userId,
          readAt,
        },
      },
    }
  )
