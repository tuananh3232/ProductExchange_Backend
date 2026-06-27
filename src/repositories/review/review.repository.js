import mongoose from 'mongoose'
import Review from '../../models/review.model.js'

export const create = (data) => Review.create(data)

export const findById = (id) => Review.findById(id)

export const findByOrderAndProduct = (orderId, productId) => Review.findOne({ order: orderId, product: productId })

export const findMany = ({ filter = {}, skip = 0, limit = 10, sortBy = 'createdAt', sortOrder = -1 } = {}) =>
  Review.find(filter)
    .populate('reviewer', 'name avatar')
    .populate('reply.repliedBy', 'name avatar')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .lean()

export const countMany = (filter = {}) => Review.countDocuments(filter)

export const updateById = (id, data) =>
  Review.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .populate('reviewer', 'name avatar')
    .populate('reply.repliedBy', 'name avatar')

export const aggregateProductRating = async (productId) => {
  const id = new mongoose.Types.ObjectId(String(productId))
  const [result] = await Review.aggregate([
    { $match: { product: id, isActive: true } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
        star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ])

  if (!result) {
    return { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
  }

  return {
    average: Math.round((result.average || 0) * 10) / 10,
    count: result.count || 0,
    distribution: {
      1: result.star1 || 0,
      2: result.star2 || 0,
      3: result.star3 || 0,
      4: result.star4 || 0,
      5: result.star5 || 0,
    },
  }
}
