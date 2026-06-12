import mongoose from 'mongoose'

import { env } from '../src/configs/env.config.js'
import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import {
  ACTIVE_PERMISSION_KEYS,
  DEPRECATED_PERMISSIONS,
  ROLE_PERMISSION_MAP,
  SHOP_STAFF_PERMISSIONS,
} from '../src/constants/permission.constant.js'
import { ROLES } from '../src/constants/role.constant.js'
import Permission from '../src/models/permission.model.js'
import Role from '../src/models/role.model.js'
import ShopInvitation from '../src/models/shop-invitation.model.js'
import Shop from '../src/models/shop.model.js'
import { ensureRbacSeedData } from '../src/services/rbac/rbac-seed.service.js'

const SAFE_DB_NAMES = new Set([
  'anhdecor_test',
  'anhdecor_dev',
  'productexchange_test',
  'productexchange_dev',
  'product_dev',
  'product_local',
])

const BLOCKED_DB_NAMES = new Set([
  'anhdecor',
  'productexchange',
  'prod',
  'production',
])

const STAFF_PERMISSION_MAPPINGS = {
  'shop:view_stats': ['shop:stats:read'],
  'shop:update': ['shop:profile:update'],
  'shop:manage_staff': ['shop:staff:read', 'shop:staff:invite', 'shop:staff:remove'],
  'shop:manage_staff_permissions': ['shop:staff_permission:read'],
  'shop:chat_manage': ['shop:chat:read', 'shop:chat:send', 'shop:chat:mark_read'],
  'product_visual_asset:manage': ['shop:product:visual_asset_manage'],
}

const isTrue = (value) => String(value).toLowerCase() === 'true'
const isAuditOnly = isTrue(process.env.RBAC_AUDIT_ONLY)
const allowReset = isTrue(process.env.ALLOW_RBAC_RESET)
const allowBlockedDbReset = isTrue(process.env.ALLOW_BLOCKED_DB_RBAC_RESET)
const allowedStaffPermissions = new Set(SHOP_STAFF_PERMISSIONS)
const deprecatedPermissionSet = new Set(DEPRECATED_PERMISSIONS)

const maskMongoUri = (uri = '') => {
  if (!uri) return '(empty)'

  try {
    const url = new URL(uri)
    if (url.password) url.password = '****'
    return url.toString()
  } catch {
    return uri.replace(/\/\/([^:/?#]+):([^@]+)@/, '//$1:****@')
  }
}

const getDbName = () => {
  const configuredDbName = env.mongodb.dbName
  if (configuredDbName) return configuredDbName

  try {
    const url = new URL(env.mongodb.uri)
    return url.pathname.replace(/^\/+/, '')
  } catch {
    return ''
  }
}

const printTargetContext = (targetDbName) => {
  console.log('RBAC permission reset target:')
  console.log(`- NODE_ENV: ${env.nodeEnv}`)
  console.log(`- Target DB name: ${targetDbName || '(empty)'}`)
  console.log(`- Mongo URI: ${maskMongoUri(env.mongodb.uri)}`)
  console.log(`- Audit only: ${isAuditOnly}`)
}

const assertSafeResetTarget = (targetDbName) => {
  const normalizedDbName = targetDbName.toLowerCase()

  if (env.nodeEnv === 'production') {
    throw new Error('Refusing to reset RBAC permissions when NODE_ENV=production')
  }

  if (!allowReset) {
    throw new Error('Refusing to reset RBAC permissions without ALLOW_RBAC_RESET=true')
  }

  if (!normalizedDbName) {
    throw new Error('Refusing to reset RBAC permissions because DB name is empty')
  }

  if (BLOCKED_DB_NAMES.has(normalizedDbName)) {
    if (normalizedDbName === 'anhdecor' && env.nodeEnv === 'development' && allowBlockedDbReset) {
      console.warn(`WARNING: resetting RBAC permission data on blocked DB: ${targetDbName}`)
      return
    }

    throw new Error(`Refusing to reset RBAC permissions on blocked DB name: ${targetDbName}`)
  }

  if (!SAFE_DB_NAMES.has(normalizedDbName)) {
    throw new Error(`Refusing to reset RBAC permissions on non-whitelisted DB name: ${targetDbName}`)
  }
}

const assertConnectedToExpectedDb = (expectedDbName) => {
  const actualDbName = mongoose.connection.db?.databaseName
  console.log(`- Actual DB name: ${actualDbName || '(empty)'}`)

  if (actualDbName !== expectedDbName) {
    throw new Error(`Connected DB mismatch. Expected ${expectedDbName}, got ${actualDbName || '(empty)'}`)
  }
}

const createEmptyPermissionCleanupReport = () => ({
  scannedDocuments: 0,
  affectedDocuments: 0,
  updatedDocuments: 0,
  mapped: new Map(),
  removed: new Map(),
  remainingDeprecated: new Map(),
  remainingInvalid: new Map(),
})

const incrementMap = (map, key, count = 1) => {
  if (!key) return
  map.set(key, (map.get(key) || 0) + count)
}

const addMappedPermission = (report, from, to) => {
  const key = `${from} -> ${to}`
  incrementMap(report.mapped, key)
}

const normalizeStaffPermissionList = (permissions = [], report) => {
  const nextPermissions = []

  permissions.filter(Boolean).forEach((permission) => {
    const mappedPermissions = STAFF_PERMISSION_MAPPINGS[permission]

    if (mappedPermissions) {
      mappedPermissions.forEach((mappedPermission) => {
        addMappedPermission(report, permission, mappedPermission)
        if (allowedStaffPermissions.has(mappedPermission)) nextPermissions.push(mappedPermission)
      })
      return
    }

    if (allowedStaffPermissions.has(permission)) {
      nextPermissions.push(permission)
      return
    }

    incrementMap(report.removed, permission)
  })

  return [...new Set(nextPermissions)]
}

const collectRemainingPermissionIssues = (permissions = [], report) => {
  permissions.forEach((permission) => {
    if (deprecatedPermissionSet.has(permission)) {
      incrementMap(report.remainingDeprecated, permission)
    }

    if (!allowedStaffPermissions.has(permission)) {
      incrementMap(report.remainingInvalid, permission)
    }
  })
}

const arraysEqual = (left = [], right = []) =>
  left.length === right.length && left.every((value, index) => value === right[index])

const cleanupShopStaffPermissions = async () => {
  const report = createEmptyPermissionCleanupReport()
  const shops = await Shop.find({}, { staffPermissions: 1 }).lean()
  report.scannedDocuments = shops.length
  const writes = []

  shops.forEach((shop) => {
    let changed = false
    const nextStaffPermissions = (shop.staffPermissions || []).map((entry) => {
      const currentPermissions = entry.permissions || []
      const nextPermissions = normalizeStaffPermissionList(currentPermissions, report)

      if (!arraysEqual(currentPermissions, nextPermissions)) changed = true
      collectRemainingPermissionIssues(nextPermissions, report)

      return {
        ...entry,
        permissions: nextPermissions,
      }
    })

    if (changed) {
      report.affectedDocuments += 1
      writes.push({
        updateOne: {
          filter: { _id: shop._id },
          update: { $set: { staffPermissions: nextStaffPermissions } },
        },
      })
    }
  })

  if (!isAuditOnly && writes.length) {
    const result = await Shop.bulkWrite(writes)
    report.updatedDocuments = result.modifiedCount || 0
  }

  return report
}

const cleanupInvitationPermissions = async () => {
  const report = createEmptyPermissionCleanupReport()
  const invitations = await ShopInvitation.find({}, { permissions: 1 }).lean()
  report.scannedDocuments = invitations.length
  const writes = []

  invitations.forEach((invitation) => {
    const currentPermissions = invitation.permissions || []
    const nextPermissions = normalizeStaffPermissionList(currentPermissions, report)
    collectRemainingPermissionIssues(nextPermissions, report)

    if (!arraysEqual(currentPermissions, nextPermissions)) {
      report.affectedDocuments += 1
      writes.push({
        updateOne: {
          filter: { _id: invitation._id },
          update: { $set: { permissions: nextPermissions } },
        },
      })
    }
  })

  if (!isAuditOnly && writes.length) {
    const result = await ShopInvitation.bulkWrite(writes)
    report.updatedDocuments = result.modifiedCount || 0
  }

  return report
}

const mapToLines = (map) => {
  if (!map.size) return ['  - none']

  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `  - ${key}: ${count}`)
}

const summarizeRoles = async () => {
  const roles = await Role.find({})
    .populate({ path: 'permissions', select: 'key' })
    .sort({ code: 1 })
    .lean()

  return roles.map((role) => ({
    code: role.code,
    permissionCount: role.permissions?.length || 0,
    permissions: (role.permissions || []).map((permission) => permission.key).sort(),
  }))
}

const auditPermissionCollection = async () => {
  const totalPermissions = await Permission.countDocuments({})
  const activePermissions = await Permission.countDocuments({ key: { $in: ACTIVE_PERMISSION_KEYS } })
  const deprecatedPermissions = await Permission.find({ key: { $in: DEPRECATED_PERMISSIONS } }).sort({ key: 1 }).lean()

  return {
    totalPermissions,
    activePermissions,
    deprecatedPermissions,
  }
}

const resetPermissionAndRoleCollections = async () => {
  if (isAuditOnly) {
    return {
      deletedPermissions: { deletedCount: 0 },
      clearedRolePermissions: { matchedCount: 0, modifiedCount: 0 },
    }
  }

  const deletedPermissions = await Permission.deleteMany({})
  const clearedRolePermissions = await Role.updateMany({}, { $set: { permissions: [] } })

  await ensureRbacSeedData()

  return {
    deletedPermissions,
    clearedRolePermissions,
  }
}

const printCleanupReport = (title, report) => {
  console.log(`${title}:`)
  console.log(`- Scanned documents: ${report.scannedDocuments}`)
  console.log(`- Affected documents: ${report.affectedDocuments}`)
  console.log(`- Updated documents: ${report.updatedDocuments}`)
  console.log('- Permissions mapped:')
  mapToLines(report.mapped).forEach((line) => console.log(line))
  console.log('- Permissions removed:')
  mapToLines(report.removed).forEach((line) => console.log(line))
  console.log('- Deprecated permissions remaining after cleanup plan:')
  mapToLines(report.remainingDeprecated).forEach((line) => console.log(line))
  console.log('- Permissions outside SHOP_STAFF_PERMISSIONS after cleanup plan:')
  mapToLines(report.remainingInvalid).forEach((line) => console.log(line))
}

const printModelFieldAudit = () => {
  console.log('Model permission field audit:')
  console.log('- roles.permissions: exists; ObjectId references to Permission')
  console.log('- shop.staffPermissions[].permissions: exists; string permissions, cleaned by this script')
  console.log('- shop.staffs.permissions: not present in current Shop model')
  console.log('- shop.members.permissions: not present in current Shop model')
  console.log('- shopInvitations.permissions: exists; string permissions, cleaned by this script')
  console.log('- users.permissions: not present in current User model')
  console.log('- memberPermissions: not present in current models')
}

const printFinalReport = async ({ beforeAudit, resetResult, shopReport, invitationReport }) => {
  const afterAudit = await auditPermissionCollection()
  const roles = await summarizeRoles()
  const adminRole = roles.find((role) => role.code === ROLES.ADMIN)
  const totalRemainingFieldDeprecated = shopReport.remainingDeprecated.size + invitationReport.remainingDeprecated.size
  const totalRemainingFieldInvalid = shopReport.remainingInvalid.size + invitationReport.remainingInvalid.size

  console.log('')
  console.log('RBAC permission reset report:')
  console.log(`- Mode: ${isAuditOnly ? 'audit only, no DB updates' : 'reset and cleanup'}`)
  console.log(`- Permissions before reset: ${beforeAudit.totalPermissions}`)
  console.log(`- Deprecated permissions before reset: ${beforeAudit.deprecatedPermissions.length}`)
  console.log(`- Deleted permissions count: ${resetResult.deletedPermissions.deletedCount}`)
  console.log(`- Roles cleared count: matched ${resetResult.clearedRolePermissions.matchedCount}, modified ${resetResult.clearedRolePermissions.modifiedCount}`)
  console.log(`- New active permissions seeded count: ${afterAudit.activePermissions}/${ACTIVE_PERMISSION_KEYS.length}`)
  console.log(`- Deprecated permissions remaining in permissions collection: ${afterAudit.deprecatedPermissions.length}`)
  console.log(`- Admin permissions empty: ${adminRole ? adminRole.permissionCount === 0 : false}`)
  console.log('- Admin full access: role bypass in middleware/service, not admin:* permissions')
  console.log('- Role-permission mapping collection: not used; mapping is stored in roles.permissions')
  console.log(`- Shop documents scanned: ${shopReport.scannedDocuments}`)
  console.log(`- Shop documents updated: ${shopReport.updatedDocuments}`)
  console.log(`- Invitation documents scanned: ${invitationReport.scannedDocuments}`)
  console.log(`- Invitation documents updated: ${invitationReport.updatedDocuments}`)
  console.log(`- Deprecated permissions remaining in other fields: ${totalRemainingFieldDeprecated}`)
  console.log(`- Invalid staff permissions remaining after cleanup plan: ${totalRemainingFieldInvalid}`)
  console.log(`- Staff permissions only in SHOP_STAFF_PERMISSIONS: ${totalRemainingFieldDeprecated === 0 && totalRemainingFieldInvalid === 0}`)
  console.log('')
  printCleanupReport('Shop staff permission audit', shopReport)
  console.log('')
  printCleanupReport('Shop invitation permission audit', invitationReport)
  console.log('')
  printModelFieldAudit()
  console.log('')
  console.log('Role permission matrix:')

  roles.forEach((role) => {
    const expectedCount = ROLE_PERMISSION_MAP[role.code]?.length ?? 'n/a'
    console.log(`- ${role.code}: ${role.permissionCount} permissions, expected matrix count: ${expectedCount}`)
    role.permissions.forEach((permissionKey) => {
      console.log(`  - ${permissionKey}`)
    })
  })

  if (!isAuditOnly && afterAudit.deprecatedPermissions.length) {
    throw new Error(`Deprecated permissions remain in Permission collection: ${afterAudit.deprecatedPermissions.map((permission) => permission.key).join(', ')}`)
  }
}

const resetRbacPermissions = async () => {
  const targetDbName = getDbName()
  printTargetContext(targetDbName)
  assertSafeResetTarget(targetDbName)

  await connectDB()
  assertConnectedToExpectedDb(targetDbName)

  const beforeAudit = await auditPermissionCollection()
  const resetResult = await resetPermissionAndRoleCollections()
  const shopReport = await cleanupShopStaffPermissions()
  const invitationReport = await cleanupInvitationPermissions()

  await printFinalReport({
    beforeAudit,
    resetResult,
    shopReport,
    invitationReport,
  })
}

resetRbacPermissions()
  .catch((error) => {
    console.error('')
    console.error(`RBAC permission reset aborted: ${error.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })
