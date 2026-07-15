import os from 'os'
import JobLease from '../../models/job-lease.model.js'
import { expireCheckout } from '../payment/payment-attempt.service.js'
import { autoCompleteOrder } from '../order/commerce-order.service.js'
import { runRentalMaintenance } from '../rental/rental.service.js'
import { purgeExpiredRejectedKyc } from '../auth/auth.service.js'
import { env } from '../../configs/env.config.js'

const workerId = `${os.hostname()}:${process.pid}`
const lockMs = 60 * 1000

const recurring = {
  rental_maintenance: { intervalMs: 15 * 60 * 1000, enabled: () => env.features.rental, run: () => runRentalMaintenance() },
  kyc_retention: { intervalMs: 24 * 60 * 60 * 1000, enabled: () => true, run: () => purgeExpiredRejectedKyc() },
}

const handlers = {
  checkout_expiry: (payload) => expireCheckout(payload.checkoutId),
  order_auto_complete: (payload) => autoCompleteOrder(payload.orderId),
  rental_maintenance: recurring.rental_maintenance.run,
  kyc_retention: recurring.kyc_retention.run,
}

const enqueueRecurring = async (jobType, runAt = new Date()) => {
  const definition = recurring[jobType]
  if (!definition?.enabled()) return
  const bucket = Math.floor(runAt.getTime() / definition.intervalMs)
  await JobLease.updateOne(
    { jobKey: `${jobType}:${bucket}` },
    { $setOnInsert: { jobType, payload: {}, status: 'pending', runAt } },
    { upsert: true }
  )
}

export const ensureMaintenanceJobs = async () => {
  await Promise.all(Object.keys(recurring).map((jobType) => enqueueRecurring(jobType)))
}

export const runNextJob = async () => {
  const now = new Date()
  const job = await JobLease.findOneAndUpdate(
    {
      runAt: { $lte: now },
      status: { $in: ['pending', 'failed', 'running'] },
      $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }],
    },
    {
      status: 'running',
      lockedBy: workerId,
      lockExpiresAt: new Date(now.getTime() + lockMs),
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after', sort: { runAt: 1 } }
  )
  if (!job) return null
  try {
    const handler = handlers[job.jobType]
    if (!handler) throw new Error(`Không có handler cho job ${job.jobType}`)
    await handler(job.payload)
    if (recurring[job.jobType]) {
      await enqueueRecurring(job.jobType, new Date(Date.now() + recurring[job.jobType].intervalMs))
    }
    job.status = 'completed'
    job.completedAt = new Date()
    job.lockExpiresAt = null
    job.lockedBy = null
    await job.save()
  } catch (error) {
    job.status = job.attempts >= job.maxAttempts ? 'dead' : 'failed'
    job.lastError = error.message
    job.runAt = new Date(Date.now() + Math.min(job.attempts * 60 * 1000, 15 * 60 * 1000))
    job.lockExpiresAt = null
    job.lockedBy = null
    await job.save()
  }
  return job
}
