/**
 * Format user object for response
 * Extracts only essential user fields to send to client
 */
export const toUserResponse = (user) => ({
  id: user._id?.toString?.() || user.id,
  name: user.name,
  email: user.email,
  role: user.role,
})
