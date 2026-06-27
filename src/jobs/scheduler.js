import { runRentalMaintenance } from '../services/rental/rental.service.js'

// Chu kỳ chạy tác vụ nền (ms). Mặc định 15 phút, có thể override qua env.
const RENTAL_MAINTENANCE_INTERVAL_MS =
  parseInt(process.env.RENTAL_MAINTENANCE_INTERVAL_MS, 10) || 15 * 60 * 1000

let rentalTimer = null

const runRentalTick = async () => {
  try {
    const { overdueCount } = await runRentalMaintenance()
    if (overdueCount > 0) {
      console.log(`⏰ Bảo trì thuê: ${overdueCount} booking chuyển sang quá hạn`)
    }
  } catch (error) {
    console.error('Bảo trì thuê thất bại:', error.message)
  }
}

/**
 * Khởi động các job nền. Gọi sau khi đã kết nối DB.
 * Dùng setInterval (không thêm dependency); chạy ngay 1 lần lúc boot rồi lặp lại.
 */
export const startSchedulers = () => {
  if (rentalTimer) {
    return
  }

  runRentalTick()
  rentalTimer = setInterval(runRentalTick, RENTAL_MAINTENANCE_INTERVAL_MS)
  if (typeof rentalTimer.unref === 'function') {
    rentalTimer.unref()
  }
}

export const stopSchedulers = () => {
  if (rentalTimer) {
    clearInterval(rentalTimer)
    rentalTimer = null
  }
}
