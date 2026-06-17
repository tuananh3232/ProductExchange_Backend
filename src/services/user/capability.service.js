import * as roleRepo from '../../repositories/role/role.repository.js'
import { PERMISSION_METADATA } from '../../constants/permission.constant.js'
import { ROLES } from '../../constants/role.constant.js'

/**
 * Trả về danh sách role + permission + metadata của user hiện tại.
 * FE dùng để bật/tắt UI mà không cần đoán mò.
 */
export const getUserCapabilities = async (roles = []) => {
  if (Array.isArray(roles) && roles.includes(ROLES.ADMIN)) {
    return { roles, permissions: ['*'], metadata: {} }
  }

  const dbRoles = await roleRepo.findByCodesWithPermissions(roles)
  const granted = new Set()

  for (const role of dbRoles) {
    for (const perm of role.permissions || []) {
      granted.add(perm.key)
    }
  }

  const permissions = [...granted]
  const metadata = Object.fromEntries(
    permissions
      .filter((p) => PERMISSION_METADATA[p])
      .map((p) => [p, PERMISSION_METADATA[p]])
  )

  return { roles, permissions, metadata }
}
