import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import User from '../src/models/user.model.js'
import Role from '../src/models/role.model.js'
import { ROLES } from '../src/constants/role.constant.js'

const normalizeRoles = (roles, legacyRole) => {
  const nextRoles = Array.isArray(roles) ? roles.filter(Boolean) : []
  if (legacyRole) nextRoles.push(legacyRole)
  const normalized = nextRoles.map((role) => (role === 'user' ? ROLES.MEMBER : role))
  return [...new Set(normalized)].length ? [...new Set(normalized)] : [ROLES.MEMBER]
}

const run = async () => {
  await connectDB()

  const users = await User.collection
    .find(
      {
        $or: [
          { role: { $exists: true } },
          { roles: { $exists: false } },
          { roles: { $not: { $type: 'array' } } },
          { roles: { $size: 0 } },
          { roles: 'user' },
        ],
      },
      { projection: { role: 1, roles: 1 } }
    )
    .toArray()

  let updatedCount = 0

  for (const user of users) {
    const roles = normalizeRoles(user.roles, user.role)
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { roles },
        $unset: { role: '' },
      }
    )
    updatedCount += 1
  }

  console.log(`Migrated ${updatedCount} users: normalized roles[], converted user to member, and removed legacy role`)

  const legacyRole = await Role.findOne({ code: 'user' })
  if (legacyRole) {
    const memberRole = await Role.findOne({ code: ROLES.MEMBER })
    if (memberRole) {
      await Role.updateOne(
        { _id: memberRole._id },
        {
          $addToSet: { permissions: { $each: legacyRole.permissions || [] } },
          $set: { name: 'Member', description: 'Member' },
        }
      )
      await Role.deleteOne({ _id: legacyRole._id })
    } else {
      await Role.updateOne(
        { _id: legacyRole._id },
        {
          $set: {
            code: ROLES.MEMBER,
            name: 'Member',
            description: 'Member',
          },
        }
      )
    }
    console.log('Migrated RBAC role code user -> member')
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })
