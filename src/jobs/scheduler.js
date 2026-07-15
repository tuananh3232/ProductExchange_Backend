import { ensureMaintenanceJobs, runNextJob } from '../services/jobs/job-lease.service.js'

let jobTimer = null

export const startSchedulers = () => {
  if (jobTimer) return
  ensureMaintenanceJobs().catch((error) => console.error('Không thể khởi tạo maintenance job:', error.message))
  const runJobTick = () => runNextJob().catch((error) => console.error('Job lease thất bại:', error.message))
  runJobTick()
  jobTimer = setInterval(runJobTick, 5000)
  if (typeof jobTimer.unref === 'function') jobTimer.unref()
}

export const stopSchedulers = () => {
  if (!jobTimer) return
  clearInterval(jobTimer)
  jobTimer = null
}
