import crypto from 'crypto'
import IdempotencyCommand from '../models/idempotency-command.model.js'
import AppError from './app-error.util.js'
import HTTP_STATUS from '../constants/http-status.constant.js'

const LOCK_MS = 30 * 1000
const WAIT_MS = 15 * 1000
const POLL_MS = 50
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const tryTakeOverExpired = async (record, ownerToken) => IdempotencyCommand.findOneAndUpdate(
  { _id: record._id, status: 'processing', lockExpiresAt: { $lte: new Date() } },
  { ownerToken, lockExpiresAt: new Date(Date.now() + LOCK_MS) },
  { returnDocument: 'after' }
)

export const runIdempotentCommand = async ({ commandKey, resourceType, loadResource, execute }) => {
  const ownerToken = crypto.randomUUID()
  let record
  try {
    record = await IdempotencyCommand.create({
      commandKey,
      ownerToken,
      resourceType,
      lockExpiresAt: new Date(Date.now() + LOCK_MS),
    })
  } catch (error) {
    if (error?.code !== 11000) throw error
  }

  if (!record) {
    const deadline = Date.now() + WAIT_MS
    while (Date.now() < deadline) {
      record = await IdempotencyCommand.findOne({ commandKey })
      if (!record) return runIdempotentCommand({ commandKey, resourceType, loadResource, execute })
      if (record.status === 'completed' && record.resourceId) {
        const resource = await loadResource(record.resourceId)
        if (resource) return resource
      }
      const takeover = await tryTakeOverExpired(record, ownerToken)
      if (takeover) {
        record = takeover
        break
      }
      await wait(POLL_MS)
    }
    if (!record || record.ownerToken !== ownerToken) {
      throw new AppError('Lệnh cùng Idempotency-Key đang được xử lý', HTTP_STATUS.CONFLICT, 'IDEMPOTENCY_IN_PROGRESS')
    }
  }

  try {
    const resource = await execute()
    await IdempotencyCommand.updateOne(
      { _id: record._id, ownerToken },
      {
        status: 'completed',
        resourceId: resource._id,
        completedAt: new Date(),
        lockExpiresAt: new Date(),
      }
    )
    return resource
  } catch (error) {
    await IdempotencyCommand.deleteOne({ _id: record._id, ownerToken, status: 'processing' })
    throw error
  }
}
