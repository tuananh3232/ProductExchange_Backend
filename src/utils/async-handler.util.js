/**
 * Wraps an async route handler so thrown errors are forwarded to Express's
 * next(error) without requiring a try-catch block in every controller.
 *
 * Usage:
 *   export const getProduct = asyncHandler(async (req, res) => {
 *     const product = await productService.getProductById(req.params.id)
 *     sendSuccess(res, { data: { product } })
 *   })
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)
