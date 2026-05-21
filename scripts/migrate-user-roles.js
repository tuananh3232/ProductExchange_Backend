import { connectDB, disconnectDB } from '../src/configs/database.config.js'
import User from '../src/models/user.model.js'
import { ROLES } from '../src/constants/role.constant.js'

const normalizeRoles = (roles, legacyRole) => {
  const nextRoles = Array.isArray(roles) ? roles.filter(Boolean) : []
  if (legacyRole) nextRoles.push(legacyRole)
  return [...new Set(nextRoles)].length ? [...new Set(nextRoles)] : [ROLES.USER]
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

  console.log(`Migrated ${updatedCount} users: normalized roles[] and removed legacy role`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDB()
  })
