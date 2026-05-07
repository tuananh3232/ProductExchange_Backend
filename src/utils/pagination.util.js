/**
 * Tính toán thông số phân trang từ query params
 * @param {Object} query - req.query
 * @returns {{ page, limit, skip, sortBy, sortOrder }}
 */
export const getPaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  return { page, limit, skip, sortBy, sortOrder };
};

/**
 * Tạo metadata phân trang đưa vào response
 * @param {number} total - Tổng số bản ghi
 * @param {number} page
 * @param {number} limit
 * @returns {Object} meta
 */
export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Runs findMany + countMany in parallel then builds pagination meta.
 * Eliminates the repeated Promise.all + buildPaginationMeta pattern across services.
 *
 * @param {Object} repo - Repository with findMany(opts) and countMany(filter) methods
 * @param {Object} filter - Mongoose query filter
 * @param {{ page, limit, skip, sortBy, sortOrder }} pagination - From getPaginationParams()
 * @returns {{ items: Array, meta: Object }}
 */
export const paginate = async (repo, filter, { page, limit, skip, sortBy, sortOrder }) => {
  const [items, total] = await Promise.all([
    repo.findMany({ filter, skip, limit, sortBy, sortOrder }),
    repo.countMany(filter),
  ]);
  return { items, meta: buildPaginationMeta(total, page, limit) };
};
