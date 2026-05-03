import PERMISSIONS, { ROLE_PERMISSION_MAP } from '../../constants/permission.constant.js'
import { ROLE_DESCRIPTIONS } from '../../constants/role.constant.js'
import * as permissionRepo from '../../repositories/permission/permission.repository.js'
import * as roleRepo from '../../repositories/role/role.repository.js'

const toTitle = (text) =>
  text
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const ensureRbacSeedData = async () => {
  const permissionKeys = Object.values(PERMISSIONS)
  const permissionPayload = permissionKeys.map((key) => ({
    key,
    module: key.split(':')[0],
    description: key,
  }))

  await permissionRepo.upsertMany(permissionPayload)

  const permissionDocs = await permissionRepo.findByKeys(permissionKeys)
  const permissionMap = new Map(permissionDocs.map((permission) => [permission.key, permission._id]))

  const roleCodes = Object.keys(ROLE_PERMISSION_MAP)
  await Promise.all(
    roleCodes.map(async (code) => {
      const permissionIds = (ROLE_PERMISSION_MAP[code] || [])
        .map((permissionKey) => permissionMap.get(permissionKey))
        .filter(Boolean)

      return roleRepo.upsertRoleByCode({
        code,
        name: toTitle(code),
        description: ROLE_DESCRIPTIONS[code] || '',
        permissionIds,
      })
    })
  )
}
